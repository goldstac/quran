use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const YT_KEY: &str = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const ANDROID_UA: &str = "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip";
const INDEX_HTML: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../web/templates/index.html"));
const APP_JS: &[u8] = include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../web/static/app.js"));
const STYLE_CSS: &[u8] =
    include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../../web/static/style.css"));

pub struct State {
    stream_cache: Mutex<HashMap<String, String>>,
    library: Mutex<Value>,
    lib_path: PathBuf,
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
    }
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
    let lib = state.library.lock().unwrap();
    let Ok(body) = serde_json::to_string_pretty(&*lib) else {
        return;
    };
    if let Some(parent) = state.lib_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&state.lib_path, body);
}

fn handle(mut stream: TcpStream, state: &State) -> std::io::Result<()> {
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
            {
                let mut lib = state.library.lock().unwrap();
                if let Some(songs) = lib["songs"].as_array_mut() {
                    songs.retain(|s| s.get("id").and_then(|v| v.as_str()) != Some(sid));
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
    state
        .stream_cache
        .lock()
        .unwrap()
        .insert(video_id.to_string(), url.clone());
    Ok(url)
}

fn proxy(
    stream: &mut TcpStream,
    state: &State,
    video_id: &str,
    range_header: Option<&str>,
    send_body: bool,
) {
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
    let status = match resp.status() {
        206 => "206 Partial Content",
        200 => "200 OK",
        code => {
            state.stream_cache.lock().unwrap().remove(video_id);
            let msg = format!("upstream {code}");
            let _ = send_raw(stream, "500 Internal Server Error", "text/plain", msg.as_bytes(), send_body);
            return;
        }
    };
    let content_type = resp
        .header("Content-Type")
        .unwrap_or("audio/mp4")
        .to_string();
    let mut header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nAccept-Ranges: bytes\r\nCache-Control: no-cache\r\n"
    );
    if let Some(cl) = resp.header("Content-Length") {
        header.push_str(&format!("Content-Length: {cl}\r\n"));
    }
    if let Some(cr) = resp.header("Content-Range") {
        header.push_str(&format!("Content-Range: {cr}\r\n"));
    }
    header.push_str("Connection: close\r\n\r\n");
    if stream.write_all(header.as_bytes()).is_err() {
        return;
    }
    if !send_body {
        let _ = stream.flush();
        return;
    }
    let mut reader = resp.into_reader();
    let mut buf = [0u8; 65536];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if stream.write_all(&buf[..n]).is_err() {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    let _ = stream.flush();
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
