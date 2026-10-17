Android (APK) plan for v1.2.x

Current state:
- Rust already has Android path: in lib.rs, when target_os == "android", it runs embedded HTTP server (server::start) and serves web assets bundled in the binary (INDEX_HTML/APP_JS/STYLE_CSS). Desktop spawns external Python backend with guards.
- Tauri v2 configured for desktop; gen/ has android scaffolding (AndroidManifest, resources, build.gradle.kts). Icons exist in gen/android/app/src/main/res and also in tauri-app/src-tauri/icons.
- Local Android SDK/NDK not installed, so cannot run 'tauri android init/dev/build' locally. Builds will happen in CI.
- Frontend is pure web (no native mobile deps); same UI should work in WebView with responsive tweaks if needed.

Steps:
1. Ensure Android scaffolding is correct (icons, app name, identifier). Tauri gen/ exists; we may need to sync icons.
2. Update tauri.conf.json if needed for Android (maybe allow cleartext or adjust CSP). Android uses embedded server on 127.0.0.1; CSP already allows localhost.
3. Add CI job 'build-android' that runs on workflow_dispatch or tags (like desktop builds). Install Android SDK/NDK (actions/setup-java + android-actions/setup-android), setup Rust targets (aarch64-linux-android, armv7-linux-androideabi, x86_64-linux-android, i686-linux-android), run 'npx tauri android build' to produce APK/AAB, upload artifacts.
4. Optionally add runtime test later (install APK on emulator) but expensive; start with just building artifacts.
5. Document in README/AGENTS how CI builds Android (not local). Note that mobile UI may need minor CSS tweaks for small screens.

Notes:
- The embedded server serves bundled web assets (no external files needed). That’s good for mobile.
- yt-dlp/search/proxy logic is in embedded server (Rust). Quran CDN direct links work fine over HTTPS.
- Keep the same codebase; no need to split web vs mobile.
