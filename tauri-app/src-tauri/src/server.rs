use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const YT_KEY: &str = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const ANDROID_UA: &str = "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip";
const VISIONOS_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const UA: &str = "quran-app/1.0";
const INDEX_HTML: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../web/templates/index.html"));
const APP_JS: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../web/static/app.js"));
const STYLE_CSS: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../web/static/style.css"));
const APP_LOGO: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../web/static/app_logo.png"));
const PROVIDED_BASE: &str =
    "https://raw.githubusercontent.com/goldstac/quran/development/catalog";
const QURAN_CHAPTERS_URL: &str = "https://api.quran.com/api/v4/chapters?language=en";
const MP3QURAN_URL: &str = "https://mp3quran.net/api/v3/reciters?language=en";
const QURAN_TRANS_IDS: [(&str, i64); 2] = [("en", 20), ("ta", 133)];
const QURAN_TRANS_NAMES: [(&str, &str); 2] = [
    ("en", "Saheeh International"),
    ("ta", "Abdul Hameed Baqavi"),
];
const LOCAL_EXTS: [&str; 10] = [
    ".mp3", ".m4a", ".mp4", ".webm", ".ogg", ".oga", ".opus", ".wav", ".flac", ".aac",
];

#[derive(Clone)]
struct ProvidedItem {
    id: String,
    title: String,
    munshid: String,
    cover: String,
}

struct ProvidedCatalog {
    expires: f64,
    items: Vec<ProvidedItem>,
}

struct DownloadState {
    state: String,
    progress: f64,
    error: String,
    cancel: Arc<AtomicBool>,
}

pub struct State {
    stream_cache: Mutex<HashMap<String, String>>,
    library: Mutex<Value>,
    lib_path: PathBuf,
    data_dir: PathBuf,
    quran_cache: Mutex<HashMap<String, Value>>,
    provided: Mutex<Option<ProvidedCatalog>>,
    downloads: Mutex<HashMap<String, DownloadState>>,
    discord: Mutex<Value>,
    bot: Mutex<Value>,
}

pub fn start(data_dir: PathBuf, port: u16) -> std::io::Result<()> {
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    let state = Arc::new(init_state(data_dir));
    thread::Builder::new()
        .name("quran-http".into())
        .spawn(move || serve_loop(listener, state))?;
    Ok(())
}

fn init_state(data_dir: PathBuf) -> State {
    let _ = fs::create_dir_all(&data_dir);
    let lib_path = data_dir.join("library.json");
    let library = load_library(&lib_path);
    State {
        stream_cache: Mutex::new(HashMap::new()),
        library: Mutex::new(library),
        lib_path,
        quran_cache: Mutex::new(HashMap::new()),
        provided: Mutex::new(None),
        downloads: Mutex::new(HashMap::new()),
        discord: Mutex::new(load_json_file(&data_dir.join("discord.json"))),
        bot: Mutex::new(load_json_file(&data_dir.join("bot.json"))),
        data_dir,
    }
}

fn now_secs() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

fn load_json_file(path: &Path) -> Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_object())
        .unwrap_or_else(|| json!({}))
}

fn save_json_file(path: &Path, value: &Value) {
    let Ok(body) = serde_json::to_string_pretty(value) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(path, body);
}

fn serve_loop(listener: TcpListener, state: Arc<State>) {
    for conn in listener.incoming() {
        let Ok(stream) = conn else { continue };
        let state = state.clone();
        let _ = thread::spawn(move || {
            let _ = handle(stream, &state);
        });
    }
}

fn default_library() -> Value {
    json!({"songs": [], "playlists": [{"name": "Favorites", "songs": []}]})
}

fn load_library(path: &Path) -> Value {
    let mut lib = fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_object())
        .unwrap_or_else(default_library);
    if let Some(obj) = lib.as_object_mut() {
        obj.entry("songs").or_insert_with(|| json!([]));
        obj.entry("playlists").or_insert_with(|| json!([]));
    }
    lib
}

fn save_library(state: &State) {
    let lib = state.library.lock().unwrap().clone();
    write_library(&state.lib_path, &lib);
}

fn write_library(lib_path: &Path, lib: &Value) {
    let Ok(body) = serde_json::to_string_pretty(lib) else {
        return;
    };
    if let Some(parent) = lib_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(lib_path, body);
}

fn handle(mut stream: TcpStream, state: &Arc<State>) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    if reader.read_line(&mut request_line)? == 0 {
        return Ok(());
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("/").to_string();

    let mut content_length: usize = 0;
    let mut range_header: Option<String> = None;
    let mut content_type: Option<String> = None;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 {
            break;
        }
        let line = line.trim_end_matches(['\r', '\n']);
        if line.is_empty() {
            break;
        }
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        let lname = name.trim().to_ascii_lowercase();
        let value = value.trim();
        if lname == "content-length" {
            content_length = value.parse().unwrap_or(0);
        } else if lname == "range" {
            range_header = Some(value.to_string());
        } else if lname == "content-type" {
            content_type = Some(value.to_string());
        }
    }

    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        reader.read_exact(&mut body)?;
    }

    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p.to_string(), q.to_string()),
        None => (target.clone(), String::new()),
    };
    let send_body = !method.eq_ignore_ascii_case("HEAD");

    if method.eq_ignore_ascii_case("OPTIONS") {
        return send_raw(
            &mut stream,
            "204 No Content",
            "text/plain",
            &[],
            send_body,
        );
    }

    let decoded: Vec<String> = path.split('/').skip(1).map(pct_decode).collect();
    let segments: Vec<&str> = decoded.iter().map(String::as_str).collect();
    let method_get = method.eq_ignore_ascii_case("GET");
    let method_post = method.eq_ignore_ascii_case("POST");

    match segments.as_slice() {
        [""] if method_get => {
            send_raw(&mut stream, "200 OK", "text/html; charset=utf-8", INDEX_HTML, send_body)
        }
        ["static", "app.js"] if method_get => {
            send_raw(&mut stream, "200 OK", "application/javascript; charset=utf-8", APP_JS, send_body)
        }
        ["static", "style.css"] if method_get => {
            send_raw(&mut stream, "200 OK", "text/css; charset=utf-8", STYLE_CSS, send_body)
        }
        ["static", "app_logo.png"] if method_get => {
            send_raw(&mut stream, "200 OK", "image/png", APP_LOGO, send_body)
        }
        ["api", "version"] if method_get => send_json(
            &mut stream,
            "200 OK",
            &json!({"version": env!("CARGO_PKG_VERSION"), "name": "Quran"}),
            send_body,
        ),
        ["api", "provided"] if method_get => {
            let force = query_string(&query, "refresh") == "1";
            match provided_catalog(state, force) {
                Ok(items) => {
                    let out: Vec<Value> = items
                        .iter()
                        .map(|item| {
                            json!({
                                "id": format!("provided-{}", item.id),
                                "title": item.title,
                                "channel": item.munshid,
                                "thumbnail": format!("/api/provided/cover/provided-{}", item.id),
                                "provided": true,
                            })
                        })
                        .collect();
                    send_json(&mut stream, "200 OK", &Value::Array(out), send_body)
                }
                Err(_) => send_json(
                    &mut stream,
                    "502 Bad Gateway",
                    &json!({"error": "Provided Nasheeds catalog is unavailable"}),
                    send_body,
                ),
            }
        }
        ["api", "provided", kind, id]
            if method_get && matches!(*kind, "cover" | "audio") =>
        {
            provided_asset(&mut stream, state, kind, id, range_header.as_deref(), &query, send_body);
            Ok(())
        }
        ["api", "quran", "chapters"] if method_get => {
            match quran_get(state, QURAN_CHAPTERS_URL, "chapters") {
                Ok(data) => send_json(&mut stream, "200 OK", &data, send_body),
                Err(e) => send_json(&mut stream, "500 Internal Server Error", &json!({"error": e}), send_body),
            }
        }
        ["api", "quran", "reciters"] if method_get => {
            match quran_get(state, MP3QURAN_URL, "mp3quran") {
                Ok(data) => send_json(&mut stream, "200 OK", &transform_reciters(&data), send_body),
                Err(e) => send_json(&mut stream, "500 Internal Server Error", &json!({"error": e}), send_body),
            }
        }
        ["api", "quran", "chapter_audio", moshaf, chapter] if method_get => {
            let result = moshaf
                .parse::<i64>()
                .ok()
                .zip(chapter.parse::<i64>().ok())
                .ok_or_else(|| "bad ids".to_string())
                .and_then(|(m, c)| quran_chapter_audio(state, m, c));
            match result {
                Ok(data) => send_json(&mut stream, "200 OK", &data, send_body),
                Err(e) if e == "reciter not found" => {
                    send_json(&mut stream, "404 Not Found", &json!({"error": e}), send_body)
                }
                Err(e) => send_json(&mut stream, "500 Internal Server Error", &json!({"error": e}), send_body),
            }
        }
        ["api", "quran", "translation", chapter] if method_get => {
            let lang = query_string(&query, "lang").to_ascii_lowercase();
            let result = chapter
                .parse::<i64>()
                .ok()
                .filter(|c| (1..=114).contains(c))
                .ok_or_else(|| "bad chapter".to_string())
                .and_then(|c| quran_translation(state, c, &lang));
            match result {
                Ok(data) => send_json(&mut stream, "200 OK", &data, send_body),
                Err(e) if e == "bad chapter" => {
                    send_json(&mut stream, "400 Bad Request", &json!({"error": e}), send_body)
                }
                Err(e) => send_json(&mut stream, "500 Internal Server Error", &json!({"error": e}), send_body),
            }
        }
        ["api", "search"] if method_get => {
            let q = query_string(&query, "q").trim().to_string();
            if q.is_empty() {
                return send_json(&mut stream, "200 OK", &json!([]), send_body);
            }
            match search(&q) {
                Ok(results) => send_json(&mut stream, "200 OK", &results, send_body),
                Err(e) => send_json(
                    &mut stream,
                    "500 Internal Server Error",
                    &json!({"error": e}),
                    send_body,
                ),
            }
        }
        ["api", "warm", id] if method_get => match resolve(state, id) {
            Ok(_) => send_raw(&mut stream, "204 No Content", "text/plain", &[], send_body),
            Err(e) => send_raw(
                &mut stream,
                "500 Internal Server Error",
                "text/plain",
                e.as_bytes(),
                send_body,
            ),
        },
        ["api", "proxy", id] if method_get => {
            proxy(&mut stream, state, id, range_header.as_deref(), send_body);
            Ok(())
        }
        ["api", "library"] if method_get => {
            let lib = state.library.lock().unwrap().clone();
            send_json(&mut stream, "200 OK", &lib, send_body)
        }
        ["api", "library", "add"] if method_post => {
            let Ok(song) = parse_body(&body) else {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "invalid json"}),
                    send_body,
                );
            };
            let Some(id) = song.get("id").and_then(|v| v.as_str()) else {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "id required"}),
                    send_body,
                );
            };
            let id = id.to_string();
            {
                let mut lib = state.library.lock().unwrap();
                let songs = lib["songs"].as_array_mut();
                if let Some(songs) = songs {
                    if !songs.iter().any(|s| s.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
                        let mut song = song;
                        if song.get("favorite").is_none() {
                            song["favorite"] = json!(false);
                        }
                        songs.push(song);
                        drop(lib);
                        save_library(state);
                    }
                }
            }
            send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
        }
        ["api", "library", "fav", sid] if method_post => {
            let mut found: Option<bool> = None;
            {
                let mut lib = state.library.lock().unwrap();
                if let Some(songs) = lib["songs"].as_array_mut() {
                    for s in songs.iter_mut() {
                        if s.get("id").and_then(|v| v.as_str()) == Some(sid) {
                            let cur = s.get("favorite").and_then(|v| v.as_bool()).unwrap_or(false);
                            s["favorite"] = json!(!cur);
                            found = Some(!cur);
                            break;
                        }
                    }
                }
                if found.is_some() {
                    drop(lib);
                    save_library(state);
                }
            }
            match found {
                Some(favorite) => send_json(&mut stream, "200 OK", &json!({"favorite": favorite}), send_body),
                None => send_json(
                    &mut stream,
                    "404 Not Found",
                    &json!({"error": "not found"}),
                    send_body,
                ),
            }
        }
        ["api", "library", "remove", sid] if method_post => {
            let mut removed: Vec<Value> = Vec::new();
            {
                let mut lib = state.library.lock().unwrap();
                if let Some(songs) = lib["songs"].as_array_mut() {
                    let (kept, gone): (Vec<Value>, Vec<Value>) = songs
                        .iter()
                        .cloned()
                        .partition(|s| s.get("id").and_then(|v| v.as_str()) != Some(sid));
                    removed = gone;
                    *songs = kept;
                }
                if let Some(playlists) = lib["playlists"].as_array_mut() {
                    for pl in playlists.iter_mut() {
                        if let Some(psongs) = pl["songs"].as_array_mut() {
                            psongs.retain(|s| s.get("id").and_then(|v| v.as_str()) != Some(sid));
                        }
                    }
                }
                drop(lib);
                save_library(state);
            }
            state.downloads.lock().unwrap().remove(*sid);
            for song in &removed {
                delete_song_file(state, song);
                if let Some(ap) = song.get("artfile").and_then(|v| v.as_str()) {
                    let path = Path::new(ap);
                    if path.is_file() && in_dir(path, &state.data_dir.join("local")) {
                        let _ = fs::remove_file(path);
                    }
                }
            }
            send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
        }
        ["api", "playlists"] if method_get => {
            let lib = state.library.lock().unwrap().clone();
            let pls = lib.get("playlists").cloned().unwrap_or_else(|| json!([]));
            send_json(&mut stream, "200 OK", &pls, send_body)
        }
        ["api", "playlists", "create"] if method_post => {
            let name = body_field_str(&body, "name");
            if name.is_empty() {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "name required"}),
                    send_body,
                );
            }
            {
                let mut lib = state.library.lock().unwrap();
                let exists = lib["playlists"]
                    .as_array()
                    .map(|pls| pls.iter().any(|p| p.get("name").and_then(|v| v.as_str()) == Some(name.as_str())))
                    .unwrap_or(false);
                if !exists {
                    if let Some(pls) = lib["playlists"].as_array_mut() {
                        pls.push(json!({"name": name, "songs": []}));
                    }
                    drop(lib);
                    save_library(state);
                }
            }
            send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
        }
        ["api", "playlists", "delete"] if method_post => {
            let name = body_field_str(&body, "name");
            if name.is_empty() {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "name required"}),
                    send_body,
                );
            }
            let mut removed = false;
            {
                let mut lib = state.library.lock().unwrap();
                if let Some(pls) = lib["playlists"].as_array_mut() {
                    let before = pls.len();
                    pls.retain(|p| p.get("name").and_then(|v| v.as_str()) != Some(name.as_str()));
                    removed = pls.len() != before;
                }
                if removed {
                    drop(lib);
                    save_library(state);
                }
            }
            if removed {
                send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
            } else {
                send_json(&mut stream, "404 Not Found", &json!({"error": "not found"}), send_body)
            }
        }
        ["api", "playlists", "rename"] if method_post => {
            let old = body_field_str(&body, "old");
            let new = body_field_str(&body, "new");
            if old.is_empty() || new.is_empty() {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "name required"}),
                    send_body,
                );
            }
            if old == new {
                return send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body);
            }
            let mut result: Result<(), (u16, &'static str)> = Err((404, "not found"));
            {
                let mut lib = state.library.lock().unwrap();
                let Some(pls) = lib["playlists"].as_array_mut() else {
                    drop(lib);
                    return send_json(&mut stream, "404 Not Found", &json!({"error": "not found"}), send_body);
                };
                let exists = pls.iter().any(|p| p.get("name").and_then(|v| v.as_str()) == Some(new.as_str()));
                if exists {
                    drop(lib);
                    return send_json(&mut stream, "409 Conflict", &json!({"error": "exists"}), send_body);
                }
                let mut renamed = false;
                for p in pls.iter_mut() {
                    if p.get("name").and_then(|v| v.as_str()) == Some(old.as_str()) {
                        p["name"] = json!(new);
                        renamed = true;
                        break;
                    }
                }
                if renamed {
                    drop(lib);
                    save_library(state);
                    result = Ok(());
                }
            }
            match result {
                Ok(()) => send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body),
                Err((code, msg)) => {
                    let status = if code == 404 { "404 Not Found" } else { "400 Bad Request" };
                    send_json(&mut stream, status, &json!({"error": msg}), send_body)
                }
            }
        }
        ["api", "playlists", name, "add"] if method_post => {
            let Ok(song) = parse_body(&body) else {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "invalid json"}),
                    send_body,
                );
            };
            let Some(id) = song.get("id").and_then(|v| v.as_str()).map(str::to_string) else {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "id required"}),
                    send_body,
                );
            };
            let name = *name;
            let mut outcome: Result<(), u16> = Err(404);
            {
                let mut lib = state.library.lock().unwrap();
                if let Some(pls) = lib["playlists"].as_array_mut() {
                    if let Some(pl) = pls.iter_mut().find(|p| p.get("name").and_then(|v| v.as_str()) == Some(name)) {
                        let songs = pl["songs"].as_array_mut().unwrap();
                        if !songs.iter().any(|s| s.get("id").and_then(|v| v.as_str()) == Some(id.as_str())) {
                            songs.push(song);
                            drop(lib);
                            save_library(state);
                        }
                        outcome = Ok(());
                    }
                }
            }
            match outcome {
                Ok(()) => send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body),
                Err(_) => send_json(&mut stream, "404 Not Found", &json!({"error": "not found"}), send_body),
            }
        }
        ["api", "playlists", name, "remove", sid] if method_post => {
            let name = *name;
            let mut outcome: Result<(), u16> = Err(404);
            {
                let mut lib = state.library.lock().unwrap();
                if let Some(pls) = lib["playlists"].as_array_mut() {
                    if let Some(pl) = pls.iter_mut().find(|p| p.get("name").and_then(|v| v.as_str()) == Some(name)) {
                        if let Some(songs) = pl["songs"].as_array_mut() {
                            songs.retain(|s| s.get("id").and_then(|v| v.as_str()) != Some(sid));
                        }
                        drop(lib);
                        save_library(state);
                        outcome = Ok(());
                    }
                }
            }
            match outcome {
                Ok(()) => send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body),
                Err(_) => send_json(&mut stream, "404 Not Found", &json!({"error": "not found"}), send_body),
            }
        }
        ["api", "cache"] if method_get => {
            send_json(&mut stream, "200 OK", &json!({"entries": cache_entries(state)}), send_body)
        }
        ["api", "cache", "clear"] if method_post => {
            state.stream_cache.lock().unwrap().clear();
            state.quran_cache.lock().unwrap().clear();
            *state.provided.lock().unwrap() = None;
            send_json(&mut stream, "200 OK", &json!({"ok": true, "entries": 0}), send_body)
        }
        ["api", "library", "clear"] if method_post => {
            let opts = match clear_options(&body) {
                Ok(opts) => opts,
                Err(_) => {
                    return send_json(
                        &mut stream,
                        "400 Bad Request",
                        &json!({"error": "bad options"}),
                        send_body,
                    );
                }
            };
            let result = clear_library(state, &opts);
            send_json(&mut stream, "200 OK", &result, send_body)
        }
        ["api", "discord", "status"] if method_get => {
            let discord = state.discord.lock().unwrap().clone();
            send_json(
                &mut stream,
                "200 OK",
                &json!({
                    "state": "no-discord",
                    "enabled": discord.get("enabled").cloned().unwrap_or(Value::Null),
                    "hidden": discord.get("hidden").cloned().unwrap_or(Value::Null),
                }),
                send_body,
            )
        }
        ["api", "discord", "hidden"] if method_post => {
            let ids = match parse_body(&body).ok().and_then(|v| v.get("ids").cloned()) {
                Some(Value::Array(arr))
                    if arr.len() <= 500
                        && arr
                            .iter()
                            .all(|v| v.as_str().is_some_and(|s| s.len() <= 64)) =>
                {
                    Value::Array(arr)
                }
                _ => {
                    return send_json(
                        &mut stream,
                        "400 Bad Request",
                        &json!({"error": "bad ids"}),
                        send_body,
                    );
                }
            };
            let mut discord = state.discord.lock().unwrap();
            discord["hidden"] = ids;
            save_json_file(&state.data_dir.join("discord.json"), &discord);
            send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
        }
        ["api", "discord"] if method_post => {
            let enabled = parse_body(&body)
                .ok()
                .and_then(|v| v.get("enabled").and_then(|e| e.as_bool()));
            if let Some(enabled) = enabled {
                let mut discord = state.discord.lock().unwrap();
                discord["enabled"] = json!(enabled);
                save_json_file(&state.data_dir.join("discord.json"), &discord);
            }
            send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
        }
        ["api", "bot"] if method_get => {
            let bot = state.bot.lock().unwrap().clone();
            send_json(
                &mut stream,
                "200 OK",
                &json!({
                    "enabled": bot.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false),
                    "url": bot.get("url").and_then(|v| v.as_str()).unwrap_or("http://127.0.0.1:3000"),
                    "linked": false,
                    "user": Value::Null,
                    "last": {"at": 0, "ok": null, "error": ""},
                }),
                send_body,
            )
        }
        ["api", "bot"] if method_post => {
            let data = parse_body(&body).unwrap_or_else(|_| json!({}));
            let mut bot = state.bot.lock().unwrap();
            if let Some(enabled) = data.get("enabled").and_then(|v| v.as_bool()) {
                bot["enabled"] = json!(enabled);
            }
            if let Some(url) = data.get("url").and_then(|v| v.as_str()) {
                bot["url"] = json!(url.trim().trim_end_matches('/'));
            }
            save_json_file(&state.data_dir.join("bot.json"), &bot);
            send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
        }
        ["api", "bot", "link"] | ["api", "bot", "test"] | ["api", "bot", "unlink"]
            if method_post =>
        {
            send_json(
                &mut stream,
                "200 OK",
                &json!({"ok": false, "error": "The Discord bot is not available on this device"}),
                send_body,
            )
        }
        ["api", "report"] if method_post => {
            send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
        }
        ["api", "open"] if method_post => send_json(
            &mut stream,
            "501 Not Implemented",
            &json!({"ok": false, "error": "not available on this device"}),
            send_body,
        ),
        ["api", "updates"] if method_get => send_json(
            &mut stream,
            "200 OK",
            &json!({
                "current": env!("CARGO_PKG_VERSION"),
                "platform": "android",
                "releases": [],
                "error": null,
            }),
            send_body,
        ),
        ["api", "update"] if method_post => send_json(
            &mut stream,
            "200 OK",
            &json!({"ok": false, "error": "Updates are not available on this device"}),
            send_body,
        ),
        ["api", "update", "status"] if method_get => send_json(
            &mut stream,
            "200 OK",
            &json!({"state": "idle", "tag": "", "asset": "", "downloaded": 0, "total": 0, "error": ""}),
            send_body,
        ),
        ["api", "update", "run"] if method_post => send_json(
            &mut stream,
            "200 OK",
            &json!({"ok": false, "error": "Updates are not available on this device"}),
            send_body,
        ),
        ["api", "download"] if method_post => {
            let sid = body_field_str(&body, "id");
            if sid.is_empty() {
                return send_json(
                    &mut stream,
                    "404 Not Found",
                    &json!({"error": "not found"}),
                    send_body,
                );
            }
            let song = find_song(state, &sid);
            let Some(song) = song else {
                return send_json(
                    &mut stream,
                    "404 Not Found",
                    &json!({"error": "not found"}),
                    send_body,
                );
            };
            if song.get("local").and_then(|v| v.as_bool()).unwrap_or(false) {
                return send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "already local"}),
                    send_body,
                );
            }
            let stored = song_file_path(state, &song).is_some()
                && song.get("downloaded").and_then(|v| v.as_bool()).unwrap_or(false);
            if stored {
                return send_json(
                    &mut stream,
                    "200 OK",
                    &json!({"ok": true, "already": true}),
                    send_body,
                );
            }
            let mut start = false;
            {
                let mut dls = state.downloads.lock().unwrap();
                let downloading = dls
                    .get(&sid)
                    .map(|d| d.state == "downloading")
                    .unwrap_or(false);
                if !downloading {
                    dls.insert(
                        sid.clone(),
                        DownloadState {
                            state: "downloading".into(),
                            progress: 0.0,
                            error: String::new(),
                            cancel: Arc::new(AtomicBool::new(false)),
                        },
                    );
                    start = true;
                }
            }
            if start {
                let worker_state = Arc::clone(state);
                let worker_id = sid.clone();
                thread::spawn(move || run_download(worker_state, worker_id));
                send_json(&mut stream, "200 OK", &json!({"ok": true}), send_body)
            } else {
                send_json(
                    &mut stream,
                    "200 OK",
                    &json!({"ok": true, "already": true}),
                    send_body,
                )
            }
        }
        ["api", "download", "status"] if method_get => {
            let dls = state.downloads.lock().unwrap();
            let mut out = serde_json::Map::new();
            for (id, d) in dls.iter() {
                out.insert(
                    id.clone(),
                    json!({
                        "state": d.state,
                        "progress": d.progress,
                        "error": if d.error.is_empty() { Value::Null } else { json!(d.error) },
                    }),
                );
            }
            send_json(&mut stream, "200 OK", &json!({"downloads": out}), send_body)
        }
        ["api", "download", "remove"] if method_post => {
            let sid = body_field_str(&body, "id");
            let mut canceled = false;
            {
                let mut dls = state.downloads.lock().unwrap();
                let downloading = dls
                    .get(&sid)
                    .map(|d| d.state == "downloading")
                    .unwrap_or(false);
                if downloading {
                    if let Some(d) = dls.get(&sid) {
                        d.cancel.store(true, Ordering::Relaxed);
                    }
                    canceled = true;
                }
                dls.remove(&sid);
            }
            if !canceled {
                let mut lib = state.library.lock().unwrap().clone();
                let mut changed = false;
                if let Some(songs) = lib["songs"].as_array_mut() {
                    if let Some(song) = songs
                        .iter_mut()
                        .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(sid.as_str()))
                    {
                        delete_song_file(state, song);
                        if let Some(obj) = song.as_object_mut() {
                            obj.remove("filepath");
                            obj.remove("downloaded");
                        }
                        changed = true;
                    }
                }
                if changed {
                    write_library(&state.lib_path, &lib);
                    *state.library.lock().unwrap() = lib;
                }
            }
            send_json(
                &mut stream,
                "200 OK",
                &json!({"ok": true, "canceled": canceled}),
                send_body,
            )
        }
        ["api", "file", sid] if method_get => {
            let song = find_song(state, sid);
            match song.as_ref().and_then(|s| song_file_path(state, s)) {
                Some(path) => {
                    serve_local_file(&mut stream, &path, range_header.as_deref(), send_body)
                }
                None => send_json(
                    &mut stream,
                    "404 Not Found",
                    &json!({"error": "no file"}),
                    send_body,
                ),
            }
        }
        ["api", "local"] if method_post => {
            let ct = content_type.clone().unwrap_or_default();
            match multipart_file(&body, &ct) {
                Some((file_bytes, filename)) if !filename.is_empty() => {
                    api_local_import(&mut stream, state, &file_bytes, &filename, send_body)
                }
                _ => send_json(
                    &mut stream,
                    "400 Bad Request",
                    &json!({"error": "file required"}),
                    send_body,
                ),
            }
        }
        ["api", "local-thumb", _sid] if method_get => send_json(
            &mut stream,
            "404 Not Found",
            &json!({"error": "no art"}),
            send_body,
        ),
        _ => send_json(&mut stream, "404 Not Found", &json!({"error": "not found"}), send_body),
    }
}

fn parse_body(body: &[u8]) -> Result<Value, ()> {
    if body.is_empty() {
        return Err(());
    }
    serde_json::from_slice(body).map_err(|_| ())
}

fn body_field_str(body: &[u8], field: &str) -> String {
    parse_body(body)
        .ok()
        .and_then(|v| {
            v.get(field)
                .and_then(|f| f.as_str())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_default()
}

fn pct_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 3 <= bytes.len() => {
                let hex = &s[i + 1..i + 3];
                if let Ok(v) = u8::from_str_radix(hex, 16) {
                    out.push(v);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn query_string(query: &str, key: &str) -> String {
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if pct_decode(k) == key {
                return pct_decode(v);
            }
        }
    }
    String::new()
}

fn send_raw(
    stream: &mut TcpStream,
    status: &str,
    content_type: &str,
    body: &[u8],
    send_body: bool,
) -> std::io::Result<()> {
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(header.as_bytes())?;
    if send_body {
        stream.write_all(body)?;
    }
    stream.flush()
}

fn send_json(
    stream: &mut TcpStream,
    status: &str,
    value: &Value,
    send_body: bool,
) -> std::io::Result<()> {
    let body = serde_json::to_vec(value).unwrap_or_else(|_| b"{}".to_vec());
    send_raw(stream, status, "application/json; charset=utf-8", &body, send_body)
}

fn api_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        .timeout_read(Duration::from_secs(20))
        .timeout_write(Duration::from_secs(20))
        .build()
}

fn stream_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        .timeout_read(Duration::from_secs(30))
        .timeout_write(Duration::from_secs(30))
        .build()
}

fn innertube_post(url: &str, body: &Value, ua: &str) -> Result<Value, String> {
    let resp = api_agent()
        .post(url)
        .set("Content-Type", "application/json")
        .set("User-Agent", ua)
        .send_json(body.clone())
        .map_err(|e| e.to_string())?;
    resp.into_json().map_err(|e| e.to_string())
}

fn resolve(state: &State, video_id: &str) -> Result<String, String> {
    if let Some(url) = state.stream_cache.lock().unwrap().get(video_id) {
        return Ok(url.clone());
    }
    let url = resolve_visionos(video_id).or_else(|_| resolve_android(video_id))?;
    state
        .stream_cache
        .lock()
        .unwrap()
        .insert(video_id.to_string(), url.clone());
    Ok(url)
}

fn resolve_android(video_id: &str) -> Result<String, String> {
    let body = json!({
        "context": {"client": {
            "clientName": "ANDROID",
            "clientVersion": "20.10.38",
            "androidSdkVersion": 34,
            "hl": "en",
            "gl": "US"
        }},
        "videoId": video_id,
        "contentCheckOk": true,
        "racyCheckOk": true
    });
    let url = format!("https://www.youtube.com/youtubei/v1/player?key={YT_KEY}");
    let data = innertube_post(&url, &body, ANDROID_UA)?;
    pick_audio_url(&data)
}

fn resolve_visionos(video_id: &str) -> Result<String, String> {
    let page = api_agent()
        .get(&format!("https://www.youtube.com/watch?v={video_id}"))
        .set("User-Agent", VISIONOS_UA)
        .set("Accept-Language", "en-US,en;q=0.9")
        .call()
        .map_err(|e| e.to_string())?
        .into_string()
        .map_err(|e| e.to_string())?;
    let marker = "\"visitorData\":\"";
    let start = page.find(marker).ok_or("no visitor data")? + marker.len();
    let rest = &page[start..];
    let end = rest.find('"').ok_or("no visitor data")?;
    let visitor = rest[..end]
        .replace("\\u003d", "=")
        .replace("\\u0026", "&");
    let body = json!({
        "context": {"client": {
            "clientName": "VISIONOS",
            "clientVersion": "1.02",
            "deviceMake": "Apple",
            "deviceModel": "RealityDevice17,1",
            "userAgent": VISIONOS_UA,
            "osName": "visionOS",
            "osVersion": "26.5.23O471",
            "hl": "en",
            "gl": "US",
            "visitorData": visitor
        }},
        "videoId": video_id,
        "contentCheckOk": true,
        "racyCheckOk": true
    });
    let url = format!("https://www.youtube.com/youtubei/v1/player?key={YT_KEY}");
    let resp = api_agent()
        .post(&url)
        .set("Content-Type", "application/json")
        .set("User-Agent", VISIONOS_UA)
        .set("X-Goog-Visitor-Id", &visitor)
        .send_json(body)
        .map_err(|e| e.to_string())?;
    let data: Value = resp.into_json().map_err(|e| e.to_string())?;
    pick_audio_url(&data)
}

fn pick_audio_url(data: &Value) -> Result<String, String> {
    let Some(formats) = data.pointer("/streamingData/adaptiveFormats").and_then(|f| f.as_array()) else {
        return Err("no formats".into());
    };
    let mut best: Option<(bool, u64, String)> = None;
    for f in formats {
        let mime = f.get("mimeType").and_then(|m| m.as_str()).unwrap_or("");
        if !mime.starts_with("audio/") {
            continue;
        }
        let Some(stream_url) = f.get("url").and_then(|u| u.as_str()) else {
            continue;
        };
        let is_mp4 = mime.contains("audio/mp4");
        let bitrate = f.get("bitrate").and_then(|b| b.as_u64()).unwrap_or(0);
        let better = match &best {
            None => true,
            Some((prev_mp4, prev_br, _)) => is_mp4 > *prev_mp4 || (is_mp4 == *prev_mp4 && bitrate > *prev_br),
        };
        if better {
            best = Some((is_mp4, bitrate, stream_url.to_string()));
        }
    }
    let Some((_, _, url)) = best else {
        return Err("no stream".into());
    };
    Ok(url)
}

fn proxy(
    stream: &mut TcpStream,
    state: &State,
    video_id: &str,
    range_header: Option<&str>,
    send_body: bool,
) {
    if let Some(song) = find_song(state, video_id) {
        if let Some(path) = song_file_path(state, &song) {
            let _ = serve_local_file(stream, &path, range_header, send_body);
            return;
        }
    }
    let url = match resolve(state, video_id) {
        Ok(u) => u,
        Err(e) => {
            let _ = send_raw(stream, "500 Internal Server Error", "text/plain", e.as_bytes(), send_body);
            return;
        }
    };
    let mut req = stream_agent()
        .get(&url)
        .set("User-Agent", ANDROID_UA)
        .set("Accept-Encoding", "identity");
    if let Some(range) = range_header {
        req = req.set("Range", range);
    }
    let resp = match req.call() {
        Ok(r) => r,
        Err(e) => {
            state.stream_cache.lock().unwrap().remove(video_id);
            let msg = e.to_string();
            let _ = send_raw(stream, "500 Internal Server Error", "text/plain", msg.as_bytes(), send_body);
            return;
        }
    };
    if resp.status() != 200 && resp.status() != 206 {
        state.stream_cache.lock().unwrap().remove(video_id);
        let msg = format!("upstream {}", resp.status());
        let _ = send_raw(stream, "500 Internal Server Error", "text/plain", msg.as_bytes(), send_body);
        return;
    }
    let _ = relay(stream, resp, send_body, None, "");
}

fn search(query: &str) -> Result<Value, String> {
    let body = json!({
        "context": {"client": {
            "clientName": "WEB",
            "clientVersion": "2.20250101.00.00",
            "hl": "en",
            "gl": "US"
        }},
        "query": query
    });
    let url = format!("https://www.youtube.com/youtubei/v1/search?key={YT_KEY}");
    let data = innertube_post(&url, &body, "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")?;
    let mut out: Vec<Value> = Vec::new();
    let mut seen = HashSet::new();
    collect_videos(&data, &mut out, &mut seen);
    out.truncate(15);
    Ok(Value::Array(out))
}

fn collect_videos(value: &Value, out: &mut Vec<Value>, seen: &mut HashSet<String>) {
    match value {
        Value::Object(map) => {
            for key in ["videoRenderer", "compactVideoRenderer"] {
                if let Some(renderer) = map.get(key) {
                    if let Some(song) = video_from_renderer(renderer) {
                        if let Some(id) = song.get("id").and_then(|v| v.as_str()) {
                            if seen.insert(id.to_string()) {
                                out.push(song);
                            }
                        }
                    }
                }
            }
            for child in map.values() {
                collect_videos(child, out, seen);
            }
        }
        Value::Array(arr) => {
            for child in arr {
                collect_videos(child, out, seen);
            }
        }
        _ => {}
    }
}

fn runs_text(value: Option<&Value>) -> String {
    let Some(value) = value else {
        return String::new();
    };
    if let Some(s) = value.get("simpleText").and_then(|t| t.as_str()) {
        return s.to_string();
    }
    if let Some(runs) = value.get("runs").and_then(|r| r.as_array()) {
        return runs
            .iter()
            .filter_map(|r| r.get("text").and_then(|t| t.as_str()))
            .collect::<Vec<_>>()
            .join("");
    }
    String::new()
}

fn parse_duration_secs(s: &str) -> u64 {
    let mut secs: u64 = 0;
    for part in s.split(':') {
        if let Ok(n) = part.trim().parse::<u64>() {
            secs = secs * 60 + n;
        } else {
            return 0;
        }
    }
    secs
}

fn video_from_renderer(renderer: &Value) -> Option<Value> {
    let id = renderer.get("videoId")?.as_str()?.to_string();
    let title = {
        let t = runs_text(renderer.get("title"));
        if t.is_empty() {
            "Unknown".to_string()
        } else {
            t
        }
    };
    let channel = renderer
        .pointer("/ownerText/runs/0/text")
        .or_else(|| renderer.pointer("/longBylineText/runs/0/text"))
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let thumbnail = renderer
        .pointer("/thumbnail/thumbnails")
        .and_then(|t| t.as_array())
        .and_then(|a| a.last())
        .and_then(|t| t.get("url"))
        .and_then(|u| u.as_str())
        .unwrap_or("")
        .to_string();
    let duration_string = runs_text(renderer.get("lengthText"));
    let duration = parse_duration_secs(&duration_string);
    Some(json!({
        "id": id,
        "title": title,
        "channel": channel,
        "duration_string": duration_string,
        "duration": duration,
        "thumbnail": thumbnail,
    }))
}

fn relay(
    stream: &mut TcpStream,
    resp: ureq::Response,
    send_body: bool,
    content_type: Option<&str>,
    extra: &str,
) -> std::io::Result<()> {
    let status = match resp.status() {
        200 => "200 OK",
        206 => "206 Partial Content",
        code => {
            let msg = format!("upstream {code}");
            return send_raw(stream, "502 Bad Gateway", "text/plain", msg.as_bytes(), send_body);
        }
    };
    let ctype = content_type
        .map(str::to_string)
        .or_else(|| resp.header("Content-Type").map(str::to_string))
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let mut header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache\r\n"
    );
    if let Some(cl) = resp.header("Content-Length") {
        header.push_str(&format!("Content-Length: {cl}\r\n"));
    }
    if let Some(cr) = resp.header("Content-Range") {
        header.push_str(&format!("Content-Range: {cr}\r\n"));
    }
    header.push_str(extra);
    header.push_str("Connection: close\r\n\r\n");
    stream.write_all(header.as_bytes())?;
    if !send_body {
        return stream.flush();
    }
    pipe_body(stream, resp.into_reader())
}

fn pipe_body(stream: &mut TcpStream, mut reader: impl Read) -> std::io::Result<()> {
    let mut buf = [0u8; 65536];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => stream.write_all(&buf[..n])?,
            Err(_) => break,
        }
    }
    stream.flush()
}

fn cache_entries(state: &State) -> usize {
    let stream = state.stream_cache.lock().unwrap().len();
    let quran = state.quran_cache.lock().unwrap().len();
    let provided = usize::from(state.provided.lock().unwrap().is_some());
    stream + quran + provided
}

fn quran_get(state: &State, url: &str, key: &str) -> Result<Value, String> {
    if let Some(cached) = state.quran_cache.lock().unwrap().get(key) {
        return Ok(cached.clone());
    }
    let resp = api_agent()
        .get(url)
        .set("User-Agent", UA)
        .call()
        .map_err(|e| e.to_string())?;
    let data: Value = resp.into_json().map_err(|e| e.to_string())?;
    state
        .quran_cache
        .lock()
        .unwrap()
        .insert(key.to_string(), data.clone());
    Ok(data)
}

fn quran_style_score(name: &str) -> i64 {
    let n = name.to_lowercase();
    if n.contains("hafs") && n.contains("murattal") {
        0
    } else if n.contains("hafs") {
        1
    } else if n.contains("murattal") {
        2
    } else if n.contains("mojawwad") || n.contains("mujawwad") {
        4
    } else {
        3
    }
}

fn transform_reciters(data: &Value) -> Value {
    let empty: Vec<Value> = Vec::new();
    let reciters = data
        .get("reciters")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);
    let mut out: Vec<Value> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for rec in reciters {
        let no_moshaf: Vec<Value> = Vec::new();
        let moshaf = rec.get("moshaf").and_then(|v| v.as_array()).unwrap_or(&no_moshaf);
        let mut full: Vec<&Value> = Vec::new();
        for m in moshaf {
            let surah_total = m.get("surah_total").and_then(|v| v.as_i64()).unwrap_or(0);
            let server = m.get("server").and_then(|v| v.as_str()).unwrap_or("");
            let parts: Vec<&str> = m
                .get("surah_list")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect();
            if surah_total == 114 && parts.len() >= 114 && !server.is_empty() {
                full.push(m);
            }
        }
        if full.is_empty() {
            continue;
        }
        full.sort_by_key(|m| {
            quran_style_score(m.get("name").and_then(|v| v.as_str()).unwrap_or(""))
        });
        let m = full[0];
        let name = rec.get("name").and_then(|v| v.as_str()).unwrap_or("Reciter");
        let style = m.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let mut label = name.to_string();
        if !style.is_empty() && !style.contains("Hafs A'n Assem") && !style.contains("Murattal") {
            label = format!("{name} · {style}");
        }
        if !seen.insert(label.clone()) {
            continue;
        }
        let id = m
            .get("id")
            .and_then(|v| v.as_i64())
            .filter(|v| *v != 0)
            .or_else(|| rec.get("id").and_then(|v| v.as_i64()))
            .unwrap_or(0);
        out.push(json!({
            "id": id,
            "reciter_name": name,
            "style": if style.is_empty() { Value::Null } else { json!(style) },
            "label": label,
            "server": m.get("server").cloned().unwrap_or(Value::Null),
        }));
    }
    out.sort_by(|a, b| {
        a.get("reciter_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase()
            .cmp(
                &b.get("reciter_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_lowercase(),
            )
    });
    json!({"recitations": out, "source": "mp3quran"})
}

fn quran_chapter_audio(state: &State, moshaf: i64, chapter: i64) -> Result<Value, String> {
    let key = format!("audio:{moshaf}:{chapter}");
    if let Some(cached) = state.quran_cache.lock().unwrap().get(&key) {
        return Ok(cached.clone());
    }
    let data = quran_get(state, MP3QURAN_URL, "mp3quran")?;
    let empty: Vec<Value> = Vec::new();
    let reciters = data
        .get("reciters")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);
    let mut server: Option<String> = None;
    for rec in reciters {
        let no_moshaf: Vec<Value> = Vec::new();
        let moshaf_list = rec.get("moshaf").and_then(|v| v.as_array()).unwrap_or(&no_moshaf);
        for m in moshaf_list {
            if m.get("id").and_then(|v| v.as_i64()) == Some(moshaf) {
                server = m
                    .get("server")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                break;
            }
        }
        if server.is_some() {
            break;
        }
    }
    let Some(server) = server else {
        return Err("reciter not found".into());
    };
    let payload = json!({"url": format!("{}{:03}.mp3", server, chapter), "format": "mp3"});
    state
        .quran_cache
        .lock()
        .unwrap()
        .insert(key, payload.clone());
    Ok(payload)
}

fn quran_translation(state: &State, chapter: i64, lang: &str) -> Result<Value, String> {
    if !(1..=114).contains(&chapter) {
        return Err("bad chapter".into());
    }
    let lang = QURAN_TRANS_IDS
        .iter()
        .find(|(l, _)| *l == lang)
        .map(|(l, _)| *l)
        .unwrap_or("en");
    let rid = QURAN_TRANS_IDS
        .iter()
        .find(|(l, _)| *l == lang)
        .map(|(_, id)| *id)
        .unwrap_or(20);
    let name = QURAN_TRANS_NAMES
        .iter()
        .find(|(l, _)| *l == lang)
        .map(|(_, n)| *n)
        .unwrap_or("Saheeh International");
    let url = format!(
        "https://api.quran.com/api/v4/verses/by_chapter/{chapter}?fields=text_uthmani&translations={rid}&per_page=300"
    );
    let key = format!("ayahs:{rid}:{chapter}");
    let data = quran_get(state, &url, &key)?;
    let empty: Vec<Value> = Vec::new();
    let raw = data
        .get("verses")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);
    let mut verses: Vec<Value> = Vec::new();
    for (i, v) in raw.iter().enumerate() {
        let num = v
            .get("verse_number")
            .and_then(|x| x.as_i64())
            .unwrap_or(i as i64 + 1);
        let arabic = v.get("text_uthmani").and_then(|x| x.as_str()).unwrap_or("");
        let no_trs: Vec<Value> = Vec::new();
        let trs = v.get("translations").and_then(|x| x.as_array()).unwrap_or(&no_trs);
        let text = trs
            .first()
            .and_then(|t| t.get("text"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        verses.push(json!({
            "num": num,
            "arabic": arabic,
            "text": strip_verse_html(text),
        }));
    }
    Ok(json!({"lang": lang, "name": name, "verses": verses}))
}

fn strip_verse_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < text.len() {
        if !text[i..].starts_with('<') {
            let ch = text[i..].chars().next().unwrap_or('\u{fffd}');
            out.push(ch);
            i += ch.len_utf8();
            continue;
        }
        if text[i..].starts_with("<sup") {
            let after_tag = text[i..].find('>').map(|p| i + p + 1).unwrap_or(text.len());
            i = match text[after_tag..].find("</sup>") {
                Some(p) => after_tag + p + 6,
                None => text.len(),
            };
            continue;
        }
        i = text[i..].find('>').map(|p| i + p + 1).unwrap_or(text.len());
    }
    out.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&quot;", "\"")
}

fn valid_provided_id(id: &str) -> bool {
    !id.is_empty()
        && id.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !id.starts_with('-')
        && !id.ends_with('-')
        && !id.contains("--")
}

fn valid_cover(id: &str, cover: &str) -> bool {
    let prefix = format!("covers/{id}.");
    match cover.strip_prefix(&prefix) {
        Some(ext) => matches!(ext, "jpg" | "jpeg" | "png" | "webp"),
        None => false,
    }
}

fn provided_catalog(state: &State, force: bool) -> Result<Vec<ProvidedItem>, String> {
    {
        let cache = state.provided.lock().unwrap();
        if let Some(cat) = cache.as_ref() {
            if !force && now_secs() < cat.expires {
                return Ok(cat.items.clone());
            }
        }
    }
    let resp = api_agent()
        .get(&format!("{PROVIDED_BASE}/index.json"))
        .set("User-Agent", UA)
        .call()
        .map_err(|e| e.to_string())?;
    let raw: Value = resp.into_json().map_err(|e| e.to_string())?;
    let empty: Vec<Value> = Vec::new();
    let entries = raw
        .get("nasheeds")
        .and_then(|v| v.as_array())
        .unwrap_or(&empty);
    let mut items: Vec<ProvidedItem> = Vec::new();
    for entry in entries {
        let id = entry.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let title = entry.get("title").and_then(|v| v.as_str()).unwrap_or("");
        let munshid = entry.get("munshid").and_then(|v| v.as_str()).unwrap_or("");
        let cover = entry.get("cover").and_then(|v| v.as_str()).unwrap_or("");
        let expected_audio = format!("audio/{id}.mp3");
        if !valid_provided_id(id)
            || id.len() > 55
            || title.trim().is_empty()
            || munshid.trim().is_empty()
            || entry.get("audio").and_then(|v| v.as_str()) != Some(expected_audio.as_str())
            || !valid_cover(id, cover)
        {
            continue;
        }
        items.push(ProvidedItem {
            id: id.to_string(),
            title: title.trim().to_string(),
            munshid: munshid.trim().to_string(),
            cover: cover.to_string(),
        });
    }
    *state.provided.lock().unwrap() = Some(ProvidedCatalog {
        expires: now_secs() + 300.0,
        items: items.clone(),
    });
    Ok(items)
}

fn cover_type(cover: &str) -> &'static str {
    if cover.ends_with(".png") {
        "image/png"
    } else if cover.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    }
}

fn provided_asset(
    stream: &mut TcpStream,
    state: &State,
    kind: &str,
    id: &str,
    range: Option<&str>,
    query: &str,
    send_body: bool,
) {
    let items = match provided_catalog(state, false) {
        Ok(items) => items,
        Err(_) => {
            let _ = send_json(
                stream,
                "502 Bad Gateway",
                &json!({"error": "Provided Nasheeds catalog is unavailable"}),
                send_body,
            );
            return;
        }
    };
    let sid = id.strip_prefix("provided-").unwrap_or(id);
    let Some(item) = items.iter().find(|i| i.id == sid) else {
        let _ = send_json(
            stream,
            "404 Not Found",
            &json!({"error": "nasheed not found"}),
            send_body,
        );
        return;
    };
    let rel = if kind == "cover" {
        item.cover.clone()
    } else {
        format!("audio/{}.mp3", item.id)
    };
    let mut req = api_agent()
        .get(&format!("{PROVIDED_BASE}/{rel}"))
        .set("User-Agent", UA);
    if kind == "audio" {
        if let Some(range) = range {
            req = req.set("Range", range);
        }
    }
    let resp = match req.call() {
        Ok(r) => r,
        Err(e) => {
            let _ = send_json(
                stream,
                "502 Bad Gateway",
                &json!({"error": e.to_string()}),
                send_body,
            );
            return;
        }
    };
    let content_type = if kind == "cover" {
        Some(cover_type(&item.cover))
    } else {
        Some("audio/mpeg")
    };
    let extra = if kind == "audio" && query_string(query, "download") == "1" {
        format!("Content-Disposition: attachment; filename=\"{}.mp3\"\r\n", item.id)
    } else {
        String::new()
    };
    let _ = relay(stream, resp, send_body, content_type, &extra);
}

struct ClearOpts {
    nasheeds: bool,
    playlists: bool,
    downloads: bool,
    local: bool,
}

fn clear_options(body: &[u8]) -> Result<ClearOpts, ()> {
    let data = if body.is_empty() {
        json!({})
    } else {
        serde_json::from_slice::<Value>(body).map_err(|_| ())?
    };
    if !data.is_object() {
        return Err(());
    }
    fn opt(data: &Value, key: &str) -> Result<bool, ()> {
        match data.get(key) {
            None => Ok(true),
            Some(Value::Bool(b)) => Ok(*b),
            _ => Err(()),
        }
    }
    Ok(ClearOpts {
        nasheeds: opt(&data, "nasheeds")?,
        playlists: opt(&data, "playlists")?,
        downloads: opt(&data, "downloads")?,
        local: opt(&data, "local")?,
    })
}

fn remove_inside(path_str: &str, data_dir: &Path, subdirs: &[&str]) -> bool {
    let path = Path::new(path_str);
    if !path.is_file() {
        return false;
    }
    let Ok(canon) = path.canonicalize() else {
        return false;
    };
    for sub in subdirs {
        let Ok(dir) = data_dir.join(sub).canonicalize() else {
            continue;
        };
        if canon.starts_with(&dir) {
            return fs::remove_file(&canon).is_ok();
        }
    }
    false
}

fn clear_library(state: &State, opts: &ClearOpts) -> Value {
    let mut lib = state.library.lock().unwrap().clone();
    let mut removed = 0usize;
    let mut playlists_removed = 0usize;
    let mut files = 0usize;
    if opts.playlists {
        playlists_removed = lib
            .get("playlists")
            .and_then(|p| p.as_array())
            .map(|a| a.len())
            .unwrap_or(0);
        lib["playlists"] = json!([]);
    }
    let empty: Vec<Value> = Vec::new();
    let songs = lib.get("songs").and_then(|s| s.as_array()).unwrap_or(&empty);
    let mut kept: Vec<Value> = Vec::new();
    for song in songs {
        let mut song = song.clone();
        let is_local = song.get("local").and_then(|v| v.as_bool()).unwrap_or(false);
        let drop = if is_local { opts.local } else { opts.nasheeds };
        if drop {
            removed += 1;
            if let Some(p) = song.get("filepath").and_then(|v| v.as_str()) {
                if remove_inside(p, &state.data_dir, &["downloads", "local"]) {
                    files += 1;
                }
            }
            if let Some(p) = song.get("artfile").and_then(|v| v.as_str()) {
                if remove_inside(p, &state.data_dir, &["local"]) {
                    files += 1;
                }
            }
            continue;
        }
        let has_copy = song.get("downloaded").and_then(|v| v.as_bool()).unwrap_or(false)
            || song.get("filepath").is_some();
        if !is_local && opts.downloads && has_copy {
            if let Some(p) = song.get("filepath").and_then(|v| v.as_str()) {
                if remove_inside(p, &state.data_dir, &["downloads", "local"]) {
                    files += 1;
                }
            }
            if let Some(obj) = song.as_object_mut() {
                obj.remove("filepath");
                obj.remove("downloaded");
            }
        }
        kept.push(song);
    }
    if opts.nasheeds || opts.downloads {
        let mut dls = state.downloads.lock().unwrap();
        for d in dls.values() {
            if d.state == "downloading" {
                d.cancel.store(true, Ordering::Relaxed);
            }
        }
        dls.clear();
    }
    for (flag, dir) in [(opts.downloads, "downloads"), (opts.local, "local")] {
        if !flag {
            continue;
        }
        let Ok(entries) = fs::read_dir(state.data_dir.join(dir)) else {
            continue;
        };
        for entry in entries.flatten() {
            if entry.path().is_file() && fs::remove_file(entry.path()).is_ok() {
                files += 1;
            }
        }
    }
    lib["songs"] = Value::Array(kept);
    *state.library.lock().unwrap() = lib.clone();
    write_library(&state.lib_path, &lib);
    json!({
        "ok": true,
        "songs": removed,
        "playlists": playlists_removed,
        "files": files,
    })
}

fn find_song(state: &State, sid: &str) -> Option<Value> {
    let lib = state.library.lock().unwrap().clone();
    lib["songs"]
        .as_array()
        .and_then(|songs| {
            songs
                .iter()
                .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(sid))
        })
        .cloned()
}

fn in_dir(path: &Path, dir: &Path) -> bool {
    let Ok(canon) = path.canonicalize() else {
        return false;
    };
    let Ok(dir) = dir.canonicalize() else {
        return false;
    };
    canon.starts_with(&dir)
}

fn song_file_path(state: &State, song: &Value) -> Option<PathBuf> {
    let path_str = song.get("filepath").and_then(|v| v.as_str())?;
    let path = Path::new(path_str);
    if !path.is_file() {
        return None;
    }
    if in_dir(path, &state.data_dir.join("downloads"))
        || in_dir(path, &state.data_dir.join("local"))
    {
        return Some(path.to_path_buf());
    }
    None
}

fn delete_song_file(state: &State, song: &Value) -> bool {
    let Some(path_str) = song.get("filepath").and_then(|v| v.as_str()) else {
        return false;
    };
    let path = Path::new(path_str);
    if !path.is_file() {
        return false;
    }
    if in_dir(path, &state.data_dir.join("downloads"))
        || in_dir(path, &state.data_dir.join("local"))
    {
        return fs::remove_file(path).is_ok();
    }
    false
}

const FILE_MIMES: [(&str, &str); 10] = [
    (".m4a", "audio/mp4"),
    (".mp4", "audio/mp4"),
    (".mp3", "audio/mpeg"),
    (".webm", "audio/webm"),
    (".opus", "audio/opus"),
    (".ogg", "audio/ogg"),
    (".oga", "audio/ogg"),
    (".wav", "audio/wav"),
    (".flac", "audio/flac"),
    (".aac", "audio/aac"),
];

fn mime_for_path(path: &Path) -> &'static str {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return "application/octet-stream";
    };
    let dotted = format!(".{}", ext.to_ascii_lowercase());
    for (e, mime) in FILE_MIMES {
        if e == dotted {
            return mime;
        }
    }
    "application/octet-stream"
}

fn parse_range(range: &str, len: u64) -> Option<(u64, u64)> {
    let spec = range.strip_prefix("bytes=")?;
    let (start_s, end_s) = spec.split_once('-')?;
    if len == 0 {
        return None;
    }
    if start_s.is_empty() {
        let suffix: u64 = end_s.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        let n = suffix.min(len);
        Some((len - n, len - 1))
    } else {
        let start: u64 = start_s.parse().ok()?;
        if start >= len {
            return None;
        }
        let end = if end_s.is_empty() {
            len - 1
        } else {
            end_s.parse::<u64>().ok()?.min(len - 1)
        };
        if end < start {
            return None;
        }
        Some((start, end))
    }
}

fn serve_local_file(
    stream: &mut TcpStream,
    path: &Path,
    range: Option<&str>,
    send_body: bool,
) -> std::io::Result<()> {
    let Ok(mut file) = fs::File::open(path) else {
        return send_json(
            stream,
            "404 Not Found",
            &json!({"error": "no file"}),
            send_body,
        );
    };
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let mime = mime_for_path(path);
    let (status, start, end) = match range.and_then(|r| parse_range(r, len)) {
        Some((s, e)) => ("206 Partial Content", s, e),
        None => ("200 OK", 0u64, len.saturating_sub(1)),
    };
    let clen = if len == 0 { 0 } else { end - start + 1 };
    let mut header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache\r\nContent-Length: {clen}\r\n"
    );
    if status == "206 Partial Content" {
        header.push_str(&format!("Content-Range: bytes {start}-{end}/{len}\r\n"));
    }
    header.push_str("Connection: close\r\n\r\n");
    stream.write_all(header.as_bytes())?;
    if !send_body {
        return stream.flush();
    }
    let mut remaining = clen;
    if remaining > 0 {
        file.seek(SeekFrom::Start(start))?;
        let mut buf = [0u8; 65536];
        while remaining > 0 {
            let want = buf.len().min(remaining as usize);
            match file.read(&mut buf[..want]) {
                Ok(0) => break,
                Ok(n) => {
                    stream.write_all(&buf[..n])?;
                    remaining -= n as u64;
                }
                Err(_) => break,
            }
        }
    }
    stream.flush()
}

fn run_download(state: Arc<State>, sid: String) {
    let cancel = {
        let mut dls = state.downloads.lock().unwrap();
        let st = dls.entry(sid.clone()).or_insert_with(|| DownloadState {
            state: "downloading".into(),
            progress: 0.0,
            error: String::new(),
            cancel: Arc::new(AtomicBool::new(false)),
        });
        st.cancel.clone()
    };
    let dl_dir = state.data_dir.join("downloads");
    let _ = fs::create_dir_all(&dl_dir);
    if let Ok(entries) = fs::read_dir(&dl_dir) {
        for entry in entries.flatten() {
            if entry
                .file_name()
                .to_str()
                .is_some_and(|n| n.starts_with(&format!("{sid}.")))
            {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    let out_path = dl_dir.join(format!("{sid}.m4a"));
    let result = (|| -> Result<(), String> {
        let url = resolve(&state, &sid)?;
        let resp = stream_agent()
            .get(&url)
            .set("User-Agent", VISIONOS_UA)
            .set("Accept-Encoding", "identity")
            .call()
            .map_err(|e| e.to_string())?;
        if resp.status() != 200 && resp.status() != 206 {
            return Err(format!("upstream {}", resp.status()));
        }
        let total: u64 = resp
            .header("Content-Length")
            .and_then(|c| c.parse().ok())
            .unwrap_or(0);
        let mut file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
        let mut reader = resp.into_reader();
        let mut buf = [0u8; 65536];
        let mut written: u64 = 0;
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err("canceled".into());
            }
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
                    written += n as u64;
                    if total > 0 {
                        let progress = (written as f64 / total as f64 * 100.0).min(100.0);
                        if let Some(d) = state.downloads.lock().unwrap().get_mut(&sid) {
                            d.progress = progress;
                        }
                    }
                }
                Err(e) => return Err(e.to_string()),
            }
        }
        if written == 0 {
            return Err("download failed".into());
        }
        Ok(())
    })();
    let canceled = result.as_ref().err().map(|e| e == "canceled").unwrap_or(false);
    match result {
        Ok(()) => {
            let mut lib = state.library.lock().unwrap().clone();
            if let Some(songs) = lib["songs"].as_array_mut() {
                if let Some(song) = songs
                    .iter_mut()
                    .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(sid.as_str()))
                {
                    song["downloaded"] = json!(true);
                    song["filepath"] = json!(out_path.to_string_lossy());
                }
            }
            write_library(&state.lib_path, &lib);
            *state.library.lock().unwrap() = lib;
            let mut dls = state.downloads.lock().unwrap();
            if let Some(d) = dls.get_mut(&sid) {
                d.state = "done".into();
                d.progress = 100.0;
                d.error = String::new();
            }
        }
        Err(e) => {
            let _ = fs::remove_file(&out_path);
            let mut dls = state.downloads.lock().unwrap();
            if canceled {
                dls.remove(&sid);
            } else if let Some(d) = dls.get_mut(&sid) {
                d.state = "error".into();
                d.progress = 0.0;
                d.error = if e.is_empty() { "download failed".into() } else { e };
            }
        }
    }
}

fn find_slice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack
        .windows(needle.len())
        .position(|w| w == needle)
}

fn multipart_file(body: &[u8], content_type: &str) -> Option<(Vec<u8>, String)> {
    let boundary = content_type
        .split(';')
        .map(str::trim)
        .find_map(|p| p.strip_prefix("boundary="))?
        .trim_matches('"')
        .to_string();
    let delim = format!("--{boundary}");
    let mut pos = find_slice(body, delim.as_bytes())? + delim.len();
    loop {
        if body[pos..].starts_with(b"--") {
            return None;
        }
        if body[pos..].starts_with(b"\r\n") {
            pos += 2;
        }
        let headers_end = find_slice(&body[pos..], b"\r\n\r\n")? + pos;
        let headers = String::from_utf8_lossy(&body[pos..headers_end]).into_owned();
        let data_start = headers_end + 4;
        let next = find_slice(&body[data_start..], delim.as_bytes())? + data_start;
        let data_end = next.saturating_sub(2);
        let is_file = headers.to_ascii_lowercase().contains("filename=");
        if is_file {
            return Some((body[data_start..data_end].to_vec(), filename_of(&headers)));
        }
        pos = next;
    }
}

fn filename_of(headers: &str) -> String {
    let lower = headers.to_ascii_lowercase();
    let Some(idx) = lower.find("filename=") else {
        return String::new();
    };
    let rest = &headers[idx + 9..];
    let line = rest.split('\r').next().unwrap_or(rest);
    let line = line.split(';').next().unwrap_or(line);
    let unquoted = line.trim().trim_matches('"');
    unquoted.rsplit('/').next().unwrap_or(unquoted).to_string()
}

fn hex_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64 + d.as_secs())
        .unwrap_or(0);
    format!("{nanos:012x}")
}

fn api_local_import(
    stream: &mut TcpStream,
    state: &State,
    file_bytes: &[u8],
    filename: &str,
    send_body: bool,
) -> std::io::Result<()> {
    let ext = filename
        .rfind('.')
        .map(|i| filename[i..].to_ascii_lowercase())
        .unwrap_or_default();
    if !LOCAL_EXTS.contains(&ext.as_str()) {
        return send_json(
            stream,
            "400 Bad Request",
            &json!({"error": "unsupported file type"}),
            send_body,
        );
    }
    let local_dir = state.data_dir.join("local");
    if fs::create_dir_all(&local_dir).is_err() {
        return send_json(
            stream,
            "500 Internal Server Error",
            &json!({"error": "cannot create directory"}),
            send_body,
        );
    }
    let sid = format!("local-{}", hex_id());
    let path = local_dir.join(format!("{sid}{ext}"));
    if let Err(e) = fs::write(&path, file_bytes) {
        return send_json(
            stream,
            "500 Internal Server Error",
            &json!({"error": e.to_string()}),
            send_body,
        );
    }
    let stem = filename
        .rsplit_once('.')
        .map(|(s, _)| s)
        .unwrap_or(filename)
        .trim()
        .to_string();
    let title = if stem.is_empty() {
        "Local nasheed".to_string()
    } else {
        stem
    };
    let song = json!({
        "id": sid,
        "title": title,
        "channel": "Local nasheeds",
        "thumbnail": "",
        "duration": Value::Null,
        "duration_string": "",
        "url": "",
        "favorite": false,
        "local": true,
        "filepath": path.to_string_lossy(),
    });
    {
        let mut lib = state.library.lock().unwrap();
        if let Some(songs) = lib["songs"].as_array_mut() {
            songs.push(song.clone());
        }
        write_library(&state.lib_path, &lib);
    }
    send_json(
        stream,
        "200 OK",
        &json!({"ok": true, "song": song}),
        send_body,
    )
}
