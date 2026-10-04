pub mod server;

#[cfg(not(target_os = "android"))]
use std::fs;
#[cfg(not(target_os = "android"))]
use std::path::PathBuf;
use tauri::Manager;
#[cfg(not(target_os = "android"))]
use std::process::{Child, Command, Stdio};
#[cfg(not(target_os = "android"))]
use std::sync::Mutex;
#[cfg(not(target_os = "android"))]
use std::time::Duration;

#[cfg(not(target_os = "android"))]
struct Backend(Mutex<Option<Child>>);

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
fn try_find_backend_port() -> Option<u16> {
    for port in 5000..=5100 {
        let url = format!("http://127.0.0.1:{port}/");
        if let Ok(response) = ureq::get(&url).call() {
            if response.status() < 500 {
                return Some(port);
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    None
}

#[cfg(not(target_os = "android"))]
fn start_backend() -> Option<Child> {
    let backend_path = find_candidate_binary("quran-backend-")?;
    let ytdlp_path = find_candidate_binary("yt-dlp-")?;
    let mut child = Command::new(&backend_path)
        .env("YTDLP_PATH", &ytdlp_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;

    let stdout = child.stdout.take()?;
    let reader = std::io::BufReader::new(stdout);
    std::thread::spawn(move || {
        use std::io::BufRead;
        let mut lines = reader.lines();
        while let Some(line) = lines.next() {
            let Ok(line) = line else { break };
            if let Some(port) = line.strip_prefix("PORT=") {
                let _ = port.parse::<u16>();
            }
        }
    });

    let _ = try_find_backend_port();
    Some(child)
}

#[cfg_attr(any(target_os = "android", target_os = "ios"), tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(not(target_os = "android"))]
    let builder = builder.manage(Backend(Mutex::new(None)));
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
                if let Some(child) = start_backend() {
                    *app.state::<Backend>().0.lock().unwrap() = Some(child);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(not(target_os = "android"))]
            if let tauri::RunEvent::Exit = event {
                if let Some(mut child) = app.state::<Backend>().0.lock().unwrap().take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
            #[cfg(target_os = "android")]
            let _ = (app, event);
        });
}
