pub mod server;

#[cfg(not(target_os = "android"))]
use std::fs;
#[cfg(not(target_os = "android"))]
use std::path::PathBuf;
use tauri::Manager;
#[cfg(not(target_os = "android"))]
use std::process::{Child, ChildStdin, Command, Stdio};
#[cfg(not(target_os = "android"))]
use std::sync::Mutex;
#[cfg(not(target_os = "android"))]
use std::time::Duration;

#[cfg(not(target_os = "android"))]
struct Backend {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
}

#[cfg(not(target_os = "android"))]
fn find_candidate_binary(prefix: &str) -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let candidates = [
        exe_dir,
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../dist"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist"),
        PathBuf::from("./dist"),
    ];

    for dir in candidates {
        if !dir.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let filename = path.file_name()?.to_string_lossy();
                if filename.starts_with(prefix) {
                    return Some(path);
                }
            }
        }
    }

    None
}

#[cfg(not(target_os = "android"))]
fn wait_for_http_ok(port: u16) -> bool {
    for _ in 0..100 {
        let url = format!("http://127.0.0.1:{port}/");
        match ureq::get(&url).call() {
            Ok(response) if response.status() < 500 => return true,
            _ => std::thread::sleep(Duration::from_millis(100)),
        }
    }
    false
}

#[cfg(not(target_os = "android"))]
fn try_find_backend_port() -> Option<u16> {
    for port in 5000..=5100 {
        let url = format!("http://127.0.0.1:{port}/");
        match ureq::get(&url).call() {
            Ok(response) if response.status() < 500 => return Some(port),
            _ => {}
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    None
}

#[cfg(not(target_os = "android"))]
fn start_backend(app: &tauri::AppHandle) -> Option<(Child, ChildStdin)> {
    let backend_path = find_candidate_binary("quran-backend")?;

    let mut command = Command::new(&backend_path);
    command.env("QURAN_VERSION", env!("CARGO_PKG_VERSION"));
    command.env("QURAN_STDIN_WATCH", "1");
    if let Some(ytdlp_path) = find_candidate_binary("yt-dlp") {
        command.env("YTDLP_PATH", &ytdlp_path);
    }

    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;

    let stdin = child.stdin.take()?;
    let stdout = child.stdout.take()?;
    let stderr = child.stderr.take()?;
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        use std::io::BufRead;
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else { break };
            if let Some(port) = line.strip_prefix("PORT=") {
                if let Ok(port) = port.trim().parse::<u16>() {
                    let _ = tx.send(port);
                }
            }
        }
    });

    std::thread::spawn(move || {
        use std::io::BufRead;
        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines() {
            let Ok(_) = line else { break };
        }
    });

    let port = rx
        .recv_timeout(Duration::from_secs(30))
        .ok()
        .or_else(|| try_find_backend_port())
        .unwrap_or(5000);

    if wait_for_http_ok(port) {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.eval(&format!("window.location.href = 'http://127.0.0.1:{port}/';"));
        }
    }

    Some((child, stdin))
}

#[cfg_attr(any(target_os = "android", target_os = "ios"), tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(target_os = "android"))]
    let builder = builder.manage(Backend {
        child: Mutex::new(None),
        stdin: Mutex::new(None),
    });
    builder
        .setup(|app| {
            #[cfg(target_os = "android")]
            {
                let dir = app
                    .path()
                    .app_local_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                let _ = server::start(dir, 5000);
            }
            #[cfg(not(target_os = "android"))]
            {
                if let Some((child, stdin)) = start_backend(app.handle()) {
                    let backend = app.state::<Backend>();
                    *backend.child.lock().unwrap() = Some(child);
                    *backend.stdin.lock().unwrap() = Some(stdin);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(not(target_os = "android"))]
            if let tauri::RunEvent::Exit = event {
                // Close our end of the stdin pipe first: the backend watches it
                // for EOF and exits once the app is gone.
                drop(app.state::<Backend>().stdin.lock().unwrap().take());
                if let Some(mut child) = app.state::<Backend>().child.lock().unwrap().take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
            #[cfg(target_os = "android")]
            let _ = (app, event);
        });
}
