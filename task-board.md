# Task Board

Living list of known issues and follow-ups. Add new items at the top of the
matching section and note the platform when it is not cross-platform.

## High priority

- [ ] (none)

## Medium priority

- [ ] Windows installer is unsigned, so SmartScreen shows "Windows protected
  your PC" (user must pick More info then Run anyway). Consider code signing.

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
- [x] Generate proper app icons from the real logo. Replaced the placeholder
  green-disc set (`tauri-app/src-tauri/icons/`) with the logo-derived icon set:
  32/128/256 PNGs plus multi-size `.ico` (ImageMagick) and `.icns` (PNG chunks
  ic07-ic10) all resized from the 1254x1254 master `app_logo.png` at the repo
  root.
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
- [x] Runtime-test the packaged Windows and macOS apps in CI (new
  `runtime-test` job in `release.yml`): it installs/launches the real packaged
  app, waits for the backend on `127.0.0.1:5000`, checks `/api/version`, then
  kills the app and asserts the backend exits (proving the orphan fix on real
  OSes). Linux build keeps a backend sidecar smoke test; the AppImage itself
  was launch-tested during the rc.3 release.
- [x] Add an in-app self-updater. Backend `/api/updates` lists GitHub releases
  with the installer matching the current platform (cached, `?refresh=1`);
  `/api/update` POST `{tag}` streams the chosen release to
  `~/.local/share/quran-app/updates/` while `/api/update/status` reports
  progress; `/api/update/run` launches a downloaded build. Settings card lets
  you pick any version (pre-releases and older ones included) and shows a
  progress bar. Linux swaps the running `$APPIMAGE` in place; Windows/macOS
  open the installer.
- [x] Add an opt-in Discord presence. Backend `DiscordBridge` in `app.py`
  talks to Discord's local IPC socket/named pipe (legacy 8-byte framing,
  shared `_DISCORD_CLIENT_ID`); the frontend posts activities to
  `POST /api/discord` and polls `GET /api/discord/status`. Settings toggle +
  status badge, per-nasheed eye button hide/show (`ns_discord_hidden`),
  presence on play/seek and cleared on pause/stop/reset. Quran playback shows
  too (surah title + reciter, refreshed on reciter switch). The socket closes
  after 90s of no heartbeats to avoid stale presences.
