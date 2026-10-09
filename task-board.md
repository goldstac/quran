# Task Board

Living list of known issues and follow-ups. Add new items at the top of the
matching section and note the platform when it is not cross-platform.

## High priority

- [ ] Runtime-test the packaged Windows and macOS apps in CI or manually. CI
  only smoke tests the Windows backend sidecar (`/` and `/api/library`); the
  packaged app itself is not exercised on Windows or macOS. The Linux side is
  covered by the local launch test below.

## Medium priority

- [ ] Windows installer is unsigned, so SmartScreen shows "Windows protected
  your PC" (user must pick More info then Run anyway). Consider code signing.
- [ ] Generate proper app icons with reicon.dev. The icons in
  `tauri-app/src-tauri/icons/` are still generated placeholders (green disc on
  dark, made with ImageMagick). Feed a real logo source image through
  reicon.dev, drop the output into `tauri-app/src-tauri/icons/`, and update the
  web favicon / home screen icon if needed.

## Low priority / notes

- [ ] AppImage requires the host GStreamer (with mp3/aac/opus plugins) for
  audio. Documented in the README Requirements note; fine on typical desktops,
  silent on a GStreamer-less system.
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
- [x] Kill the orphaned backend on app exit: the app keeps the backend's stdin
  pipe open and the backend exits when it reaches EOF (`QURAN_STDIN_WATCH=1` in
  `app.py`, piped stdin held in `lib.rs`). Verified locally: the backend exits
  once the pipe closes, in both frozen-style runs and dev.
- [x] Add a `/api/version` endpoint. Single source: `QURAN_VERSION` env var
  (set by the desktop app from `CARGO_PKG_VERSION`), else `package.json`.
- [x] Add a Settings screen (sidebar nav item): app version, GitHub repo +
  latest release ("Check for updates" via the GitHub API), default volume
  slider. Also a muted `#sidebar-ver` version in the sidebar footer.
