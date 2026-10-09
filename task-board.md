# Task Board

Living list of known issues and follow-ups. Add new items at the top of the
matching section and note the platform when it is not cross-platform.

## High priority

- [ ] **Kill the orphaned backend on app exit (all platforms, confirmed on Linux).**
  The backend sidecar is a PyInstaller `--onefile` binary, so it is two
  processes: a bootloader parent plus the real Flask child.
  `tauri-app/src-tauri/src/lib.rs` (the `RunEvent::Exit` arm) calls
  `child.kill()`, which only kills the bootloader. The Flask child survives,
  keeps port 5000 bound, and the next launch either lands on 5001 or talks to
  the stale server.
  Verified: after killing the direct child, the grandchild still answered
  `HTTP 200` on `127.0.0.1:5000`.
  Options: kill the process tree on exit, or make the backend exit when its
  stdio pipe from the app closes.

## Medium priority

- [ ] Add a Settings screen in the app (reachable from the sidebar nav). Show
  the app version, GitHub info (repo link `github.com/goldstac/quran`, latest
  release / update check), and a few basic options (for example theme and
  default volume). GitHub release data can come from the GitHub API directly
  (the CSP already allows `https://`) or via a small backend endpoint.
- [ ] Show the app version somewhere small in the UI (for example a muted
  `v1.2.0-rc.3` in the sidebar footer). Add a backend `/api/version` endpoint so
  the displayed value stays in sync with the build instead of being hardcoded in
  the frontend. Version currently lives in `package.json`,
  `tauri-app/src-tauri/Cargo.toml`, `Cargo.lock` and `tauri.conf.json`, and the
  Flask side should read it from a single source.
- [ ] Runtime-test the Windows and macOS GUI in CI or manually. CI only smoke
  tests the Windows backend sidecar (`/` and `/api/library`); the packaged app
  itself is not exercised on Windows or macOS.
- [ ] Windows installer is unsigned, so SmartScreen shows "Windows protected
  your PC" (user must pick More info then Run anyway). Consider code signing.

## Low priority / notes

- [ ] AppImage requires the host GStreamer (with mp3/aac/opus plugins) for
  audio. Fine on typical desktops, silent on a GStreamer-less system.
- [ ] `Gtk-Message: Failed to load module "canberra-gtk-module"` when running
  the AppImage is cosmetic (the module is not installed on the host).
- [ ] WebView2 must be present on Windows (bundled on Win10/11); otherwise the
  default installer bootstrap needs internet during install.
- [ ] WebView2 autoplay policy may require a user click before playback; the
  frontend already surfaces the `play()` rejection as a toast.

## Done

- [x] Fix the EGL abort on Mesa 25+ hosts (strip bundled `libwayland` in
  `fix-appimage.sh`).
- [x] Keep the backend sidecar alive (drain its stdout instead of `break`ing
  after the `PORT=` line in `lib.rs`).
- [x] Restore AppImage audio without a 600 MB bundle (use the host GStreamer
  stack, neutralize the AppRun `GST_PLUGIN_SYSTEM_PATH` overrides).
- [x] Release `v1.2.0-rc.3` for Linux, macOS and Windows.
