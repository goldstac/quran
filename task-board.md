# Task Board

Living list of known issues and follow-ups. Add new items at the top of the
matching section and note the platform when it is not cross-platform.

## High priority

- [ ] Uploading an mp3 in "Your Nasheeds" did nothing (user report, Oct 24).
  ROOT CAUSE FOUND AND FIXED: the system's flatpak document portal was
  broken, not the app. The user's Brave is the flatpak `com.brave.Browser`,
  and flatpak file pickers hand the chosen file to the app through
  `org.freedesktop.portal.Documents`. That service's database
  `~/.local/share/flatpak/db/documents` had been truncated to 0 bytes on
  Oct 21 18:33 (during the disk-full episode; disk is still at 97%), so
  `xdg-document-portal.service` crash-looped with "invalid gvdb header"
  (exit status 2) every time it was activated. Result: the picker opened and
  the user picked the file (journal proves it, twice: 22:33:34 and 23:02:06,
  `Failed to register file:///home/admin/Downloads/have-you-really-departed
  -oh-our-sheykh.mp3`), the export into the sandbox failed, the page's
  `#local-file` ended up with zero files, and `addLocalFiles` returned
  silently at `if (files.length)`: no toast, no POST, nothing in `local/`.
  Fixed by deleting the 0-byte corrupt DB and starting the unit: it is now
  active and owns `org.freedesktop.portal.Documents` (bus owner `:1.438`),
  clean journal since. Needs one user retry in Brave to confirm; if the
  first pick still misbehaves, restart Brave (the portal lookup happens per
  pick, so a restart should not be needed).

  Everything else was verified working along the way: the current code
  passes a full end-to-end test (jsdom harness in `/tmp/opencode/domtest/`
  runs the real `web/static/app.js` against the live server: nav, change
  event, POST lands, toast "Added to Your Nasheeds", row renders, no JS
  errors), the backend route answers (direct test, then cleaned up), only
  one server exists (port 5000, restarted 22:33 and 23:01 with current
  code), and `local/` stayed empty through both failed attempts, proving the
  request was never sent. Improvement shipped while investigating: the old
  blanket `.catch(() => ({ error: 'failed' }))` hid every failure behind a
  useless "Could not add x.mp3: failed", so `web/ts/app.ts` now surfaces the
  real reason - HTTP 404 says "backend is out of date, restart the app",
  other HTTP errors show the backend's own `error` field or the status
  number, and a dead connection says "can't reach the backend". All three
  error branches plus the happy path are covered by the harness.
  Uncommitted: `web/ts/app.ts` + `web/static/app.js` (this plus the local
  row null-guard fix below).

  Follow-up worth considering: the disk was at 100% recently and is still
  at 97% (2.0G free of 53G), and that ENOSPC event is what corrupted the
  portal DB in the first place. `tauri-app/src-tauri/target/` (1.6G) is
  regenerable build output; user's call whether to `cargo clean`.


- [ ] Terminal startup logging for the desktop app (implemented in the
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
- [ ] Tauri v2 dropped regenerated schemas into the tree:
  `tauri-app/src-tauri/gen/schemas/` (acl-manifests, android, capabilities,
  desktop, linux, mobile JSON) is untracked. The Tauri CLI rewrites them on
  every build, nothing at runtime depends on them, and `gen/android` is already
  committed, so the tidy answer is to commit them (or gitignore them if you
  would rather not track generated files). Decide once and do it.

- [ ] Working on v1.2.1

- [x] Fix imported local nasheeds never appearing in "Your Nasheeds". The upload
  itself worked (`POST /api/local` saved the file and the `local: true` song, the
  library JSON was correct), but the list never rendered: `makeRow` renders the
  YouTube button only for non-local songs, then attached a listener to
  `r.querySelector('.yt-act')!` unconditionally, so a local row threw
  `TypeError: Cannot read properties of null (reading 'addEventListener')` inside
  `renderList`'s `forEach` and no rows were appended. The handler is now guarded
  like the neighbouring `.dl-act` one. Fixed in `web/ts/app.ts`, rebuilt into
  `web/static/app.js`. Verified: `npm run build` clean, `python3 -c "from app
  import app"` fine, and a DOM stub running the compiled `makeRow` renders a
  local song (and still throws on the pre-fix bundle, so the check is real).
  The fix itself is still uncommitted in the working tree (`web/ts/app.ts` +
  `web/static/app.js`), so fold it into the next commit.

## Medium priority

- [ ] The app's website lives in its own repo: `~/Documents/GitHub/quran-app-website`
  (public, `main`, pushed), a sibling of this repo rather than a submodule, and
  it gets its own chat session (this one owns the app, that one owns the site).
  The landing page is built and pushed (commit `b400880`): Vite + React 19 +
  TypeScript + Tailwind v4 + shadcn, with the real gradients.sh
  `MeshGradient` component behind a quran.org-style editorial page (warm cream
  canvas, serif display type, an Arabic + Tamil + English ayah hero, a
  3-column feature grid, a dark mission band, and download cards). What is
  still open on that board is hosting (GitHub Pages is the obvious fit) and
  the later pages (downloads, links). When something here ships that the site
  should advertise, or a claim about the app changes, both boards get updated
  together so the website session can pick it up.

- [ ] The APK the user tried to install would not install on a Redmi A5
  (Android 15). Source is `v1.2.1-pre-alpha.1`
  (`app-universal-release.apk`, 45721573 bytes, CI run 39145235450). User
  has since confirmed two things: the paraphrased error is "you can't
  install this app on your device" tapped from Google Files, and
  "Install unknown apps" was ALREADY enabled for Files by Google, so the
  unknown-sources gate is ruled out and the package installer itself is
  refusing.

  Ruled out by inspecting the downloaded APK directly (results recorded
  here; analysis dir `/tmp/opencode/apkcheck/` holds the re-downloaded APK
  and `signer.txt`, the first pass's `axml.py` was lost when /tmp got wiped
  by a restart, its output is quoted below):

  - It is a real `.apk`, not an `.aab` (45721573 bytes).
  - Universal build with all four ABIs present, including
    `lib/arm64-v8a/libquran_player_lib.so`, so the A5's ABI is covered.
  - Signed with the REAL release keystore: the APK Signing Block (pairs
    0x7109871a = v2, plus 0x504b4453 and 0x42726577) contains a v2 signature
    whose certificate is issued to goldstac / Quran, created 2026-10-18
    16:28:17 UTC, valid until 2054-03-05 (matching when the CI secrets were
    added at 16:29), not an Android Debug fallback. No v1 files, correct
    for minSdk 24.
  - Manifest: package `com.goldstac.quran`, versionCode 1002001, versionName
    1.2.1, minSdkVersion 24, targetSdkVersion 36, only `INTERNET` permission,
    `android.software.leanback` marked `required=0`. None of that blocks an
    Android 15 (API 35) install.
  - Native libs are stored uncompressed (`extractNativeLibs=0`) and all four
    `.so` entries sit on a 16384-byte boundary, so the Android 15 16 KB page
    size rejection for libraries does not apply either.
  - NO older release ever shipped an APK (every release's assets listed via
    `gh api`; only v1.2.1-pre-alpha.1 has one), so no earlier Quran build
    can be squatting on the package name and a signature conflict with a
    leftover install is impossible.

  First real artifact-side suspect found: `resources.arsc` is stored
  uncompressed (correct) but only 4-byte aligned, NOT page-aligned (data
  offset 44637848, i.e. 3736 bytes into a 4 KB page). Harmless on
  4 KB-page phones, but on an Android 15 device running with 16 KB pages
  the resource table must be page-mmapable and the install gets rejected,
  which matches the exact wording of the error with permission already
  granted.

  Next step needs the device. This machine already has `adb`
  (v37.0.0-android-tools at /usr/bin/adb) and the APK sits ready in
  `/tmp/opencode/apkcheck/`. Have the user enable Developer options (tap
  "MIUI version" 7 times) then USB debugging and plug the phone in, then:
  - `adb install -r app-universal-release.apk` for the exact
    `Failure [INSTALL_FAILED_...]` line,
  - `adb shell getconf PAGE_SIZE` (4096 vs 16384 decides the alignment
    theory),
  - `adb shell getprop ro.product.cpu.abilist` (confirm device ABIs).
  If it is the page size, the fix is mechanical: page-align `resources.arsc`
  in the Android build (newer AGP does it automatically, or a
  `zipalign -P 16` pass) and cut a new pre-alpha. The other candidate if
  the failure line says "incompatible": strip the AndroidTV
  `LEANBACK_LAUNCHER` category and leanback feature the Tauri template
  injects. Do not touch the Android job until the adb output is captured.

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

- [x] Bot-side embed restyle, committed and pushed on the bot's `dev`
  (`33ab5e6`, in `~/Documents/GitHub/smite-bot`: `src/commands/quran.ts`,
  `src/quran.ts`, `README.md`). The `su!track` / `su!fm` embeds now share one
  shell: author line with the app logo, title, description, a row of three
  inline stat fields, then the list fields, one footer hint. Green for
  nasheeds and confirmations, gold for Quran, amber for off/paused, grey for
  nothing to show. Emoji came out of titles, field names and footers (only the
  type markers inside the two lists remain); the progress bar is block
  characters instead of an emoji knob; now playing titles link to the YouTube
  video when the id looks like one; the card shows per-track plays beside the
  lifetime totals; `su!track off/on` sends the Not linked card instead of
  claiming success; recent list numbers are padded so item 10 lines up. All 21
  embed states rendered through a headless harness in `/tmp/opencode/bottest/`
  (limits, field grid, plurals checked), preview at
  `/tmp/opencode/embed-preview.html`. Still to do there: open the PR to `main`
  (would be #18).

- [x] Settings cards on one alignment grid (`4275ff0`). Every settings row is
  now `label (128px) | control | trailing right-aligned`, so values, status
  chips, and the button/input columns all end on the same x: the Bot URL `Test`
  row and the Link code `Link` row share a fixed 104px button with matched
  input widths, controls are a uniform 34px, the link-code field is monospace,
  and note/button rows are inset 142px to line up with the control column.
  Real bug found on the way: the mobile settings overrides were inside the
  earlier `@media(max-width:768px)` block, but a media query adds no
  specificity, so the later desktop rules won and the card layout stacked at
  every width. The overrides now live in their own block at the very end of
  `style.css`, and it is AGENTS gotcha 8. Layout verified numerically with a
  headless Firefox probe (desktop 1440px and mobile 414px). Needs one backend
  restart plus a hard refresh to show in the running app.

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
  bot side (`~/Documents/GitHub/smite-bot`) gained `src/quran.ts`
  (link codes, now playing, stats in `data/quran.json`) and
  `src/commands/quran.ts`, with the new routes, help/README updates, and a
  version bump to 3.1.0. Shipped: the app side is on `development`
  (`2481656`) and the bot side is merged into the bot's `main` (PR #17, merge
  `7bb0733`). One follow-up from the merge is still open above: the bot's
  embeds were restyled afterwards and that restyle is not committed yet.

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
  stored copy. Rows did not render at first, see the fix in High priority.

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
