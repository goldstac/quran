# Task Board

Living list of known issues and follow-ups. Add new items at the top of the
matching section and note the platform when it is not cross-platform.

## High priority

- [ ] Verbose terminal startup logging for the desktop app (implemented in the
  working tree, not committed yet, needs one real AppImage run to verify).
  Running `./Quran_*.AppImage` from a terminal prints a startup banner
  (name, version, one-line description, Linux note that GTK/GLib warnings
  below are harmless), step-by-step progress ("Starting local backend: <path>",
  "Backend running on http://127.0.0.1:<port>", "Opening the app window. Close
  it to quit.") and clear errors when the backend binary is missing, fails to
  spawn, or never answers. The Rust side also forwards the backend's
  stdout/stderr to the terminal; the backend prints its version and data
  folder on startup and quiets werkzeug request logs when frozen (dev runs
  keep them, real errors still show either way). Files: `tauri-app/src-tauri/
  src/lib.rs`, `web/app.py`. Verified so far: `cargo check` and the Python
  import/banner; commit and ship with the next tag after a real AppImage run.

- [ ] Working on v1.2.1

## Medium priority

- [ ] Android app (mobile build): create an Android version of the app using Tauri
  mobile/Android tooling, planned to run primarily in CI (not built locally).
  Keep the existing web+Tauri desktop architecture; adapt UI for mobile where
  needed. This replaces the previous note about "Android (APK) is planned later"
  with an active track.

  Implementation plan:
  - Add Android support to Tauri configuration (ensure Cargo/lib setup works for
    mobile targets). The Rust code already has `#[cfg(not(target_os = "android"))]`
    guards for spawning the desktop backend; on Android we'll run the embedded
    HTTP server in-process (we already have `server::start` in `server.rs` used
    on Android in `lib.rs`).
  - Generate Android project scaffolding via `tauri android init` if needed.
    Android SDK/NDK not present locally; we'll generate scaffolding in CI or
    commit generated files if needed. For now, note environment constraints.
  - Keep the same frontend (`web/*`) served locally by the embedded server on
    Android (port 5000) or adjust to Tauri's asset serving; the existing loading
    logic expects localhost backend so in-process server is fine.
  - Update CI to build Android APK/AAB in a dedicated job (trigger on tags or
    manual dispatch) with Android SDK/NDK setup; no local Android builds required.
  - Update `AGENTS.md` and docs to reflect Android build/run process.
  - Test APK in CI/runtime smoke test if feasible.

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

- [x] Discord bot integration (`su!track` / `su!fm`). The Settings view has a
  new "Discord bot" card: paste the bot URL (default `http://127.0.0.1:3000`)
  and the 6 character code from `su!track link`, and the app links itself with
  the bot (`POST /api/bot/link` trades the code for a token, stored in
  `~/.local/share/quran-app/bot.json`). While linked and enabled, the app
  reports playback to the bot (`POST /api/report`, forwarded to the bot's
  `/api/quran/event`) on play, pause, seek, and stop, plus a lightweight 30s
  progress ping, so the bot can show a live now playing card and count plays,
  top nasheeds, top reciters, and listening time. Nasheeds hidden with the eye
  button are never sent, and `su!track off` pauses recording from Discord. The
  bot side (`~/Documents/GitHub/smite-bot`, branch `dev`) gained `src/quran.ts`
  (link codes, now playing, stats in `data/quran.json`) and
  `src/commands/quran.ts`, with the new routes, help/README updates, and a
  version bump to 3.1.0.

- [x] Download nasheeds for offline listening. `POST /api/download` fetches the
  best audio with yt-dlp into `~/.local/share/quran-app/downloads/<id>.<ext>`
  (m4a preferred) and sets `filepath` + `downloaded: true`; `GET /api/download/
  status` reports progress; `POST /api/download/remove` cancels an in-flight
  download or deletes a finished one. `/api/file/<id>` serves stored files with
  Range support, and `/api/proxy/<id>` serves the local file automatically when
  one exists, so playback works with no wifi. Download button on track rows and
  the player bar (spinner while downloading, green check when done), a Downloads
  nav view, toasts, and AGENTS.md updated (downloads are back on purpose).
- [x] Add your own nasheeds (local MP3/MP4 import). The + button in the "Your
  Nasheeds" view uploads through `POST /api/local`, which copies the file into
  `~/.local/share/quran-app/local/` and adds a `local: true` song with the
  duration from mutagen when it is installed. Served by `/api/file/<id>` with
  Range support, played like any nasheed, YouTube button hidden, the Discord
  presence shows `Local nasheeds` for them, and removing the row deletes the
  stored copy.

- [x] Removed the install-version picker from Settings: no more version
  dropdown, pre-release/older-version selection, or downgrades. Check for
  updates now just reports the newest release and offers to install that one;
  the button stays disabled when you are already on it.
- [x] See on YouTube: every YouTube nasheed row has a button (and the player bar
  has one for the current nasheed) that opens the same video in the system
  browser via the backend (`/api/open`, YouTube hosts only), since the Tauri
  webview cannot open external URLs itself.
- [x] Faster, safer CI: a fast `validate` job on every push to `main`/`development`
  and every PR (Python import, `npm run build`, and a check that the committed
  `web/static/app.js` still matches `web/ts/app.ts`), pip/npm/Rust caching, the
  npm Tauri CLI instead of compiling `cargo install tauri-cli`, concurrency
  cancellation, per-job timeouts, and `contents: write` scoped to the release
  job. The full three-platform build now runs only on tags and manual dispatch.
- [x] Remember the Discord presence on/off toggle: stored server-side in
  `~/.local/share/quran-app/discord.json` (mirrored to localStorage `ns_discord`),
  restored on load, and re-enabled automatically if the backend restarted.

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
  `POST /api/discord` and polls `GET /api/discord/status?alive=1`. Settings
  toggle + status badge, per-nasheed eye button hide/show (`ns_discord_hidden`),
  presence on play/seek, kept as paused when the track is paused, and cleared on
  stop/reset. Quran playback shows
  too (surah title + reciter, refreshed on reciter switch). The connection is
  kept alive by a heartbeat (drops only after 120s of frontend silence and
  reconnects within 5s), so the status stops flapping between connected and
  offline.
