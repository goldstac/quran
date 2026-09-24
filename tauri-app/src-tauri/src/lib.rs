pub mod server;

#[cfg(not(target_os = "android"))]
use std::path::PathBuf;
#[cfg(not(target_os = "android"))]
use std::process::{Child, Command, Stdio};
#[cfg(not(target_os = "android"))]
use std::sync::Mutex;
#[cfg(not(target_os = "android"))]
use tauri::Manager;

#[cfg(not(target_os = "android"))]
struct Backend(Mutex<Option<Child>>);

#[cfg(not(target_os = "android"))]
fn find_web_dir() -> Option<PathBuf> {
    let candidates = [
        std::env::var("NASHEED_WEB_DIR").ok().map(PathBuf::from),
        Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../web")),
        std::env::current_dir().ok().map(|d| d.join("web")),
    ];
    candidates
        .into_iter()
        .flatten()
        .find(|p| p.join("app.py").is_file())
        .and_then(|p| p.canonicalize().ok())
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
                use tauri::Manager;
                let dir = app
                    .path()
                    .app_local_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                let _ = server::start(dir, 5000);
            }
            #[cfg(not(target_os = "android"))]
            {
                if let Some(dir) = find_web_dir() {
                    if let Ok(child) = Command::new("python3")
                        .arg("app.py")
                        .current_dir(&dir)
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .spawn()
                    {
                        *app.state::<Backend>().0.lock().unwrap() = Some(child);
                    }
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
