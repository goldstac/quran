#[path = "../server.rs"]
mod server;

fn main() {
    let dir = std::path::PathBuf::from("/tmp/opencode/quran-smoke");
    match server::start(dir, 5056) {
        Ok(()) => println!("smoke server listening on 5056"),
        Err(e) => {
            eprintln!("failed to start: {e}");
            std::process::exit(1);
        }
    }
    loop {
        std::thread::park();
    }
}
