# Task Board

Living list of known issues and follow-ups. Add new items at the top of the
matching section and note the platform when it is not cross-platform.

## High priority

- [x] The phone's system bars covered app content on the Redmi A5: the bottom
  player bar sat under the navigation buttons and the top of the UI mixed with
  the status bar clock/battery, so the hamburger only worked when you hit its
  lower half. Root cause: the app calls `enableEdgeToEdge()` and targets SDK
  36, and Android 15 enforces edge-to-edge, so the WebView draws under the
  system bars and nothing applied the insets (wry just calls
  `setContentView(webView)`). Fix in
  `gen/android/.../MainActivity.kt`: keep edge-to-edge but with explicit dark
  transparent system bar styles, set the window background to the app dark
  color so the strip behind the bars blends, and pad `android.R.id.content` by
  the system bars + display cutout via a `WindowInsetsCompat` listener that
  returns the insets unchanged (IME keeps flowing to the WebView so keyboard
  resize is untouched), with a `requestApplyInsets` re-dispatch in
  `onWebViewCreate` because wry attaches the WebView after `onCreate`. Also
  dropped the one `env(safe-area-inset-bottom)` term in `style.css`'s mobile
  modal padding since the native padding now guarantees the whole viewport is
  inside the bars. Needs device confirmation on `v1.2.1-pre-alpha.6`, which
  ships it.

- [x] Mobile (Android) backend was missing most API routes, which is why search
  results played but the library, Provided Nasheeds, Quran, settings, downloads
  and local import were all dead on the phone. The Android app runs a
  hand-rolled Rust server (`tauri-app/src-tauri/src/server.rs`) that only had 13
  routes while the frontend needs about 39. Completed the set to match
  `web/app.py`: logo + version, Provided Nasheeds (catalog/cover/audio with
  Range and `?download=1`), the four Quran routes, cache count/clear, library
  clear with the full option semantics (400 on non-bool, `{}` = full wipe, per
  category file sweeps, download flag stripping), library remove now deletes
  stored files like Flask, discord status/hidden/toggle, bot prefs, report,
  open (501), updates (empty list), `/api/file` with Range/206, proxy serving
  stored files for downloaded nasheeds, multipart `/api/local` import and the
  whole download flow (`/api/download`, `/status`, `/remove`) with progress and
  cancel. Every new route was exercised against a live server on this machine:
  Range/206 math, multipart parsing (quoted filenames, bad extension, missing
  part), download start/progress/cancel/complete/cleanup, library clear options
  and file deletion. Also fixed stream resolution while testing: the ANDROID
  innertube client returns googlevideo URLs that 403 after about 1 MB of
  transferred bytes, which would break seek-based playback and any download;
  `resolve()` now tries the VISIONOS client first (watch page fetch for
  visitorData, then the player API, same trick yt-dlp uses) and keeps ANDROID
  as fallback. Verified by streaming three separated Range requests through
  `/api/proxy` (all 206) and completing a real download (progress 21 -> 69 ->
  100, file stored, library flagged, remove cleaned it up). Changed
  `tauri-app/src-tauri/src/server.rs` only.
- [x] Released `v1.2.1-pre-alpha.5` from `development` on 2026-11-13 (Actions run
  43336833954): every job green, including the Android runtime test that boots
  the emulator, upgrades the known-good APK in place, and checks the in-app
  server plus the loading page. The prerelease ships the mobile fix batch: the
  completed Android backend routes, the VISIONOS stream resolve, the loading
  screen restyle, and the touch-friendly track rows. The Groq-written notes
  follow the fixed structure (TL;DR, `## What's new`, verbatim `## Changes`,
  `## Downloads`) and passed the pre-tag smoke test (dispatch run 43336701279).
  The APK is `app-universal-release.apk` (46.9 MB) on
  https://github.com/goldstac/quran/releases/tag/v1.2.1-pre-alpha.5 . The
  version bump commit `bb990c8` keeps package.json, Cargo.toml, Cargo.lock and
  tauri.conf.json at `1.2.1-pre-alpha.5`. Real-device feedback from the user's
  Redmi A5 is still pending, so the Redmi install question below stays open
  until they confirm the new APK installs and plays.
- [ ] The mobile fix batch is committed on `development` and awaiting push
  review: `c453b76 feat(api): complete the mobile backend routes`,
  `f939d2a fix(ci): stamp tauri config version for desktop builds`,
  `417907d style(ui): restyle the loading screen to the app theme`, and
  `a32cfcb fix(ui): make track rows and controls touch friendly on mobile`.
  `cargo check` passes in `tauri-app/src-tauri`; the backend routes were
  exercised live (see the finished item below). Nothing is pushed yet, so
  origin does not have the mobile fixes.
- [ ] The Provided Nasheeds catalog only exists on the `development` branch
  (`catalog/index.json` is not on `main`), and both backends point at it:
  `web/app.py` `_PROVIDED_BASE` and the Rust server's `PROVIDED_BASE` hardcode
  `development`. That is correct for testing (packaged builds fetch the public
  repo), but both must be switched to `main` before a stable release, and
  `main` must first receive the catalog. Tracked so release day does not ship
  an empty Provided Nasheeds page.
- [ ] AI release notes for every tag (added, needs the secret + the first tag to
  prove it): the `release` job no longer hardcodes the description. A
  `Write release notes` step diffs the new tag against the previous `v*` tag
  (`git describe`), keeps `feat`/`fix`/`perf`/`revert` subjects (falls back to
  everything if a release is all plumbing) and sends version + changes to
  Groq (`GROQ_API_KEY` secret, both set on 2026-10-27, model via `GROQ_MODEL`
  as an Actions variable or secret, default `llama-3.3-70b-versatile`, 700 max
  tokens). The model only writes a
  TL;DR plus a `## What's new` list (prompt rules: nasheeds never songs, no em
  dashes, casual tone, call out pre-releases like `v1.2.1-pre-alpha.3`, no
  invented features, no links, under 160 words). The step then appends
  `## Changes` with the verbatim commit subjects and `## Downloads` with the
  four fixed installer lines, so those two sections are exact whatever the
  model does, and the sanitizer truncates anything it writes at those two
  headings. Checkout switched to `fetch-depth: 0` for the tag diff. The
  description shows on the GitHub Releases page only: an in-app card was built
  and then removed on request (see Done). The logic moved into
  `.github/scripts/write-release-notes.sh`, called both by the `release` step
  and by a dispatch-only `release-notes-test` job, so the test exercises
  byte-identical code to what ships. That job runs
  `.github/scripts/release-notes-smoke-test.sh`, which writes the notes twice
  (once with Groq, once with `GROQ_API_KEY` blanked out to prove the fallback),
  prints both in the run log, and fails unless the structure holds: exactly one
  `## Changes` and one `## Downloads`, the four installer lines, no em dash, a
  TL;DR as the first line rather than a heading, a `## What's new` with 3 to 6
  bullets (the minimum drops to the change count when the tag has fewer than 3
  user-facing commits, so a single-fix prerelease can pass) under 160 words,
  no "songs", and byte-identical pipeline-written
  sections across the two runs. It also fails when the key is missing or Groq
  contributes nothing, so a broken key shows up before release day. Local runs
  of the smoke script: no key, a well-behaved stub 200, a disobedient stub 200
  (em dash, its own Downloads block, a code fence, "songs") and a stub 401, all
  behaving, and the disobedient case caught a bug in my own first-line heading
  check. The real Groq smoke test passed in Actions run 42257132169 on
  `development`; its summary was 54 words with four bullets, and the fallback
  and fixed sections also passed. Reading the output found one semantic miss:
  Groq advertised the Updates card release description even though a newer
  commit removed that feature. The prompt and smoke test now explicitly guard
  against that claim, and the smoke test enforces the actual 160-word cap.
  Workflow dispatch has `notes_only: true` so this validation can run without
  starting platform builds. The corrected live Groq check passed in Actions run
  42260736781 for `v1.2.1-pre-alpha.3`: 81 words, six bullets, no removed
  Updates-card claim, and identical commit/download sections in the AI and
  fallback output. Tag `v1.2.1-pre-alpha.3` was published successfully in Actions
  run 42261074833. Linux, macOS, Windows, and Android builds all passed, as did
  the Windows, macOS, and Android runtime checks. The published prerelease has
  five installers and the Groq-written description plus the verbatim commit
  list. Verified on 2026-11-06.
  `GROQ_API_KEY` and `GROQ_MODEL` are both in place.
- [ ] Tauri v2 dropped regenerated schemas into the tree:
  `tauri-app/src-tauri/gen/schemas/` (acl-manifests, android, capabilities,
  desktop, linux, mobile JSON) is untracked. The Tauri CLI rewrites them on
  every build, nothing at runtime depends on them, and `gen/android` is already
  committed, so the tidy answer is to commit them (or gitignore them if you
  would rather not track generated files). Decide once and do it.

- [x] Released `v1.2.1-pre-alpha.3` from `development`; all four platform builds
  and all three runtime checks passed in Actions run 42261074833.

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

## Medium priority

- [x] The mobile UI fixes shipped (commits `417907d` and `a32cfcb` on
  `development`): the loading page got the app theme (dark background with the
  green and gold glows, a floating logo card, fade-in, a warm error state that
  drops the spinner), track rows use a two-row grid so titles get real space
  (clamp to two lines) while duration and actions sit on their own lines, the
  Discord eye and redundant play buttons hide on phones, player controls and
  the hamburger grew to 44/46px touch targets, a single tap plays a row on
  coarse pointers (double click stays for mouse), and playback failures other
  than the autoplay policy now toast instead of vanishing. Verified
  `npm run build` clean and the compiled bundle contains the new behavior.
  Android runtime test strings untouched.

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

  2026-11-13 update: the user reports the same class of failure when
  updating a Realme C71 (which HAS `v1.2.1-pre-alpha.5` installed) to
  `v1.2.1-pre-alpha.6`, worded roughly "app not valid package to
  install". Ruled out by direct inspection of both release APKs: the
  signing certificates are byte-identical (sha256 prefix `6bbb4450`), the
  new APK's versionCode `102010006` is above the installed `102010005`,
  `apksigner verify` and `zipalign -c -P 16 -v 4` both pass, and all four
  ABIs are present, so the artifact is a valid upgrade. Working theory:
  the Realme's browser download was truncated/corrupt. Suggested to the
  user: delete the old download, re-download `app-universal-release.apk`
  (46,904,909 bytes) and check the size before installing, or copy the
  APK from the working Redmi A5 via ShareMe/Bluetooth. If that fails the
  next step is `adb install -r` from a connected phone.

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
  - `v1.2.1-pre-alpha.1` did ship an APK with versionCode `1002001` and the
    same release certificate as the newer APKs. The latest
    `v1.2.1-pre-alpha.3` APK instead has versionCode `1`, so Android rejects it
    as a downgrade when installed over the earlier release. This explains a
    generic install failure when the user already has the earlier app.

  Correction after inspecting the latest `v1.2.1-pre-alpha.3` APK:
  `resources.arsc` only needs to be stored and 4-byte aligned for package
  installation; its 16 KB offset is not an install blocker. The current 45.9 MB
  APK passes `apksigner verify` (v2 signature), `zipalign -c -P 16 -v 4`, and
  has stored 4-byte-aligned resources plus all four ABI directories. The arm64
  native library is stored at a 16 KB-aligned offset. Its package metadata is
  `com.goldstac.quran`, min SDK 24, target SDK 36, version code 1, and version
  name `1.2.1-pre-alpha.3`. The CI Android 14 x86_64 install/runtime test also
  passed. Android package installation is sound on the emulator, but it did not
  exercise upgrading from the older release. `adb devices -l` currently shows
  no connected device, so a separate clean-install issue on the Redmi A5 is
  still unconfirmed. The Android workflow now stamps an ordered
  versionCode, requires the existing release key, verifies APK metadata/signature/
  ABIs/alignment, and tests upgrade from the original release on API 35. Local
  script checks and verification of both published APKs passed. Dispatch
  42312963607 compiled Android but the package verifier caught Tauri's
  `autoIncrementVersionCode` adding one on top of the stamped value. The
  stamping script now writes the preceding value so the generated APK matches
  the intended version code. Dispatch 42315053084 produced the expected version code. APK signing verification passed, but the fingerprint comparison did not get a
  value from apksigner on CI. The preflight now checks that apksigner accepts
  the signature, while the emulator upgrade from the original APK proves signer
  continuity through Android Package Manager. The next CI run
  must confirm this verifier and the upgrade path together.

  If the user still sees a failure after the versionCode fix, next step needs
  the device. `adb` and Android SDK Build Tools are installed;
  the latest APK is at `/tmp/quran-redmi-check/app-universal-release.apk`.
  Connect the phone with USB debugging enabled and run
  `adb install -r /tmp/quran-redmi-check/app-universal-release.apk`, then
  `adb shell getconf PAGE_SIZE`, `adb shell getprop ro.product.cpu.abilist`,
  and `adb logcat -d -s PackageManager PackageInstallerSession NativeLibraryHelper`
  if install fails. Keep the exact `Failure [INSTALL_FAILED_...]` line. Use that
  result to diagnose any remaining clean-install failure; the versionCode
  downgrade is already fixed in the uncommitted Android build changes.

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

- [ ] `android-runtime-test.sh` only checks `/` and `/api/library` through the
  adb forward. Now that the mobile backend has the full route set, cheap extra
  assertions would catch regressions early: curl `/api/version` (expects the
  stamped version) and `/api/provided` (expects 200 with at least one nasheed
  while the catalog branch is `development`). Optional but nice before the
  next prerelease.
- [ ] The root disk (`/dev/sda7`) hit 100% on 2026-11-03 and took tooling down
  with it (file writes and shell output both failed with "No space left on
  device"). Freed about 830M by clearing `~/.cache` (kept `ms-playwright`), the
  repo's `dist/` and `.pyinstaller-build`, and `portfolio/.next`. Still eating
  the disk: `~/.local/share/opencode` at 4.2G (`opencode.db` 1.4G plus
  snapshots 2.8G), Discord at 1.6G (it runs from `app-1.0.166` with
  `app-1.0.168` as its pending update, so only `Cache`/`logs` are droppable,
  and only once Discord is closed), and `/var` at 7.2G (journal 1.6G, flatpak
  5G including a stale `.removed` Brave, pacman cache 630M) which all need
  sudo. Reclaim before the next big build.
- [ ] Every run now prints a Node 20 deprecation warning: GitHub is forcing
  Node 24 onto the SHA-pinned `actions/checkout` (v4), `actions/download-artifact`
  (v4), `actions/setup-java` (v4) and `android-actions/setup-android` (v3).
  Harmless today, but those pins want bumping to a Node 24 native version
  before GitHub stops running Node 20 actions at all. Keep the SHA pinning when
  you do.
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

- [x] Released `v1.2.1-pre-alpha.6` with the Android system-bar fix, plus a CI
  fix to let the release-notes smoke test pass on a single-change tag.
  The safe-area work shipped in `fix(android): keep content clear of the
  system bars` (`b27b5ea`); version files bumped in
  `chore(release): prepare v1.2.1-pre-alpha.6` (`781a8f6`).
  The first two smoke-test runs failed because Groq wrote one bullet under
  `## What's new` and the check demanded 3, which is impossible for a tag
  whose only user-facing commit is the Android fix. Fixed by scaling the
  bullet minimum to the change count in
  `.github/scripts/write-release-notes.sh` (prompt) and
  `.github/scripts/release-notes-smoke-test.sh` (check), committed as
  `fix(ci): scale the release-notes bullet minimum to the change list`
  (`efc4ee9`); smoke test passed in run 43450970206; release pipeline run
  43451158134. Needs device confirmation on the Redmi A5 (bars clearance,
  tappable hamburger).
- [x] The Data section can now wipe the whole library, not just history, and
  you choose what goes.
  New **Library** card in Settings > Data (between History and Cache) with four
  toggle rows, each showing a live count: Nasheeds `#set-lib-count`,
  Playlists `#set-pl-count`, Downloads `#set-dl-count` (offline copies),
  Local nasheeds `#set-local-count`, plus a `#set-clear-library` button.
  `POST /api/library/clear` (above the `__main__` block) takes an optional
  JSON body `{nasheeds, playlists, downloads, local}`; every key defaults to
  `true`, any non-bool value is a 400, and an empty body `{}` is a full wipe
  (back-compat, so older callers and the two original tests still work).
  Files always follow their removed entries: a dropped nasheed takes its
  `filepath` and local art thumb with it. `nasheeds` off keeps non-local
  entries with their likes; `playlists` off keeps playlists; `downloads` on
  sweeps the `downloads/` dir and strips `filepath`/`downloaded` from
  surviving nasheeds (so no orphaned flags); `local` off keeps imported
  entries and their files in `local/`. In-flight yt-dlp downloads are killed
  under `_dl_lock` only when `nasheeds` or `downloads` is on, and a download
  worker that finishes late sees its `_downloads` entry gone and returns
  before it can write to the library. Response is `{ok, songs, playlists,
  files}`.
  The card's four checkboxes persist to localStorage `ns_libclear` (missing
  keys fall back to `true`), the confirm message is built from the selection
  ("Remove your nasheeds and likes, your playlists and downloaded offline
  copies ..."), and the button disables when all four are off. The handler
  gates on `confirmDialog`, then refreshes the counts, re-renders the sidebar
  playlists, re-renders the hidden library view with
  `if (currentLibMode) loadLib(currentLibMode)` so `currentList` and playlist
  context cannot go stale, and shows the `Library cleared.` note plus toast.
  The first draft guarded on `#library-view` being active instead, which can
  never be true while Settings is open (views are mutually exclusive) and
  would have stolen the view if it ever could, so it became the mode-based
  refresh.

  Uncommitted on `development`: `web/app.py`, `web/templates/index.html`,
  `web/ts/app.ts`, rebuilt `web/static/app.js`, `web/tests/test_api.py`,
  `AGENTS.md`, `task-board.md`. Verified with `python3 -m pytest -q` (17
  passed: the 5 clear tests cover the full wipe + storage-dir sweep, the
  files-outside-the-data-dir guard, keeping local when excluded, stripping
  downloads while keeping nasheeds and playlists, and the 400 on non-bool
  options), `python3 -m mypy web/app.py` (clean),
  `python3 -c "from app import app"`, `npm run build`, and `git diff --check`.
  End to end in a real browser against `HOME=/tmp/opencode/e2e-home python3
  web/app.py --port 5055` (throwaway data, port 5055 so port 5000 stays free,
  real `~/.local/share/quran-app` untouched): card shows counts 2 / 1 / 1 / 1
  all toggled on; switching Local nasheeds off updates `ns_libclear` and the
  confirm message drops local; accepting takes the counts to 0 / 0 / 0 / 1
  with the note and toast, the sidebar playlist is gone, `GET /api/library`
  returns only `loc1`, `local/loc1.mp3` survives while `downloads/aaa111.mp3`
  is deleted; all four off disables the button; a reload restores the persisted
  off state; and `curl -d '{}'` still does the full wipe (`{files:2, ok:true,
  playlists:1, songs:2}`) leaving only `library.json`. The T3 preview
  browser's snapshot/screenshot call fails on this machine and no desktop
  browser is attached to the session, so this round was verified at DOM level
  via `preview_evaluate` rather than with screenshots. Sandbox (server,
  preview tab, fake home) cleaned up afterwards; port 5000 stayed free.

- [x] Backend now has a real test suite and a type check, both wired into CI.
  `web/tests/` (12 tests, runs in ~0.1s): `conftest.py` redirects `$HOME` to a
  temp dir *before* `import app`, so pytest never touches the real
  `~/.local/share/quran-app` data (and removes the temp home at session end);
  an autouse fixture resets `library.json` and all four caches around every
  test. `test_api.py` covers `/api/version`, `/api/cache` count +
  `/api/cache/clear` (seeded 4 entries -> 0, every cache emptied), library
  add/fav/remove with the invalid-id 400, playlist-cleanup on library remove,
  both file guards (a stored file in `downloads/` is deleted on remove, a file
  outside the data dir is deliberately kept), `Range` serving of stored files
  (200 full, `206` with `Content-Range` for `bytes=0-3`, 404 for missing/no
  copy), playlist CRUD + error statuses (400/404 on empty, unknown, and
  duplicate inputs), and the YouTube-only `/api/open` guard (non-YouTube,
  wrong scheme, `javascript:`, and empty URLs all blocked with 400; no test
  ever sends a real YouTube URL so CI cannot open a browser). Writing the
  Range test surfaced a deliberate behavior: `_clean_song` strips `filepath`
  from client-supplied songs (clients cannot inject file paths), so tests
  store files the way the download/import workers do, via `save_lib` directly.

  `mypy web/app.py` starts clean: 4 fixes in `app.py` (annotations for
  `_downloads` / `_stream_cache` / `_quran_cache`, and `getattr(sys,
  "_MEIPASS", "")` instead of `sys._MEIPASS`, which only exists under
  PyInstaller). CI: the `validate` job in `release.yml` now installs
  `web/requirements-dev.txt` (pytest + mypy + Pillow, added to the pip cache
  keys; Pillow is a dev-only dep so mypy can resolve the optional `PIL`
  cover-art import, which is not installed by the runtime requirements) and
  runs `python -m pytest -q` from `web/` plus `python -m mypy web/app.py`
  between the import check and the frontend build. `.gitignore` gained
  `.pytest_cache/`.

  Shipped on `development` with this change: `web/tests/`,
  `web/requirements-dev.txt`, `web/app.py` (the 4 type fixes only),
  `.github/workflows/release.yml`, `.gitignore`, `AGENTS.md`, `task-board.md`.
  Verified with `python3 -m pytest -q` (12 passed), `python3 -m mypy
  web/app.py` (clean), `python3 -c "from app import app"`, and
  `git diff --check`.

- [x] Settings gained a **Data** section with clear history / clear cache.
  The section (`#settings-view`) has two cards: **History** showing counts for
  recent searches (`ns_recentq`) and recently played (`ns_recent`) with a
  `#set-clear-history` button, and **Cache** showing the in-memory entry count
  (`#set-cache-entries` from `GET /api/cache`) with a `#set-clear-cache`
  button. Both buttons gate on `confirmDialog` before doing anything. Clearing
  history wipes only `ns_recentq` + `ns_recent` in localStorage, empties the
  search card's own recents state (`scItems` / `scCleared` + `scRenderRows`),
  reloads the Recently Played view when it is the active library mode, and
  refreshes both counts. Clearing cache POSTs `/api/cache/clear`, which empties
  `_stream_cache`, `_quran_cache`, `_provided_cache`, and `_update_cache` (new
  `_cache_entries()` helper totals them for `GET /api/cache` too) and returns
  the new count; both routes sit above the `__main__` block. Library,
  playlists, downloads, and imported nasheeds are deliberately untouched, and
  each card ends with a status note ("History cleared." / "Cache cleared.")
  plus a toast.

  Shipped on `development` with this change: `web/app.py`,
  `web/templates/index.html`, `web/ts/app.ts`, plus the rebuilt
  `web/static/app.js`, and the docs. Verified with `npm run build`,
  `python3 -c "from app import app"`, and a `test_client` round trip (seeded
  all four caches to 4 entries, clear returned 0 with every cache emptied).
  Visually verified with headless Firefox on the real markup + compiled
  `app.js`: the Data section renders in Settings, the confirm modal opens over
  it, and the full accept flow takes 5 searches / 3 played / 7 cache entries
  down to 0 / 0 / 0 with both notes and the toast showing. The harness's first
  run looked for the wrong accept button class (`confirmDialog` uses
  `modal-btn-danger`, labeled "Delete", not `modal-btn-primary`), which is why
  an earlier screenshot showed the modal never being accepted; the fetch stub
  also had to distinguish `/api/cache/clear` from `/api/cache`.

- [x] Refresh Settings into UI, Sound, and Discord sections. Use compact
  bordered panels and familiar form controls inspired by shadcn, adapted to
  the existing Flask UI. Align the single-panel Sound and Discord controls to
  the same content width; keep the two UI info panels in a balanced grid.
  Add concise explanations in plain language. Existing controls and IDs are
  unchanged. Checked the rendered page and `git diff --check`. Committed as
  `d9b8941` on `development`.

- [x] Add a shared **Provided Nasheeds** catalog view. Source runs read the local
  `catalog/index.json`; packaged builds fetch it from the public `main` branch
  for release `v1.2.1-pre-alpha.4` (testing builds can use `development`). The
  view displays cover, title, and
  munshid, plays MP3s through a Range-aware local proxy, and provides an MP3
  download link. Add catalog entries and matching files under `catalog/audio/`
  and `catalog/covers/`; `catalog/README.md` documents the metadata format.
  The catalog starts empty until entries are added. Privacy, terms,
  README, and AGENTS notes now describe the GitHub requests. Verified with
  `npm run build`, `python3 -c "from app import app"`, and `git diff --check`.
  The packaged catalog source was switched to `main` for release
  `v1.2.1-pre-alpha.4`. When this feature is released, add it to the separate
  website repo's task board and update the
  site copy.

- [x] The Search view runs on the Pin UI "Search Card"
  (https://www.pinui.xyz/components/search-card), ported from its React +
  framer-motion source (630 lines TSX + 562 lines CSS, pulled out of the page
  payload) into this app's vanilla TS/CSS, then restyled to belong to this app.
  The plain `.search-bar` input and the old `#recent-q` chip row are gone: the
  sticky header's search bar is now a 300px rounded field (magnifier, "Search"
  placeholder, a Ctrl K hint) that morphs in place into a 420px card on focus,
  with a "Recent searches" panel underneath. The suggestion chip row was ported
  first and then cut on request, so the card holds only recent searches now:
  `#sc-chips`, `SC_SUGGESTIONS`, `scChips`, `scRenderChips` and the
  `.psearch__chip*` / `.psearch__count` CSS are gone from HTML, TS and CSS.

  Behaviour: rows are the real recent searches (localStorage `ns_recentq`, now
  `{q, t}` objects, the old `string[]` read as `t: 0`), each with a neutral
  letter tile, a relative-time sub ("Just now", "2 hr ago", "Yesterday"), and a
  trash button with a "Remove" tooltip that only shows on the row under the
  pointer. One highlight sheet glides between rows, dividers hide around the
  active row, and a removed row collapses out over 340ms. The list filters as
  you type (`No results for "..."` when nothing matches), `Clear all` empties it
  and `Restore` brings it back (the button hides when there is nothing to
  restore). Typing still debounces into the same `doSearch`, so results render
  below exactly as before, and `/` or `S` still jumps to the view and focuses
  the input. Ctrl K / Cmd K opens it from anywhere and closes it when it is
  open, and a press outside folds it. The X runs `scDismiss()`: it clears the
  query, resets the results to the empty state, and folds the card back to the
  resting field in one click (Escape still clears first and folds on the second
  press). The kbd hint swaps to ⌘K on Mac and is hidden on mobile.

  Matched to the app instead of the demo: 12px radius with the site's input
  treatment (`rgba(255,255,255,.05)` field, hairline border) instead of a
  sharp-cornered box under a 60px drop shadow, opening switches to the opaque
  card colour with the exact green focus ring `.set-input:focus` uses
  (`border-color: rgba(29,185,84,.55)` plus `0 0 0 3px rgba(29,185,84,.14)`),
  panel radius 20px -> 8px, the "Recent searches" label is the uppercase
  11px/700 tracked label the sidebar uses, rows follow the track-row recipe
  (40px radius-4 tile on `#282828`, 14px/500 title, 12px `#a7a7a7` sub, 12px
  gap) instead of 44px gradient tiles, the hover sheet is the flat
  `rgba(255,255,255,.06)` of `.track-row:hover` instead of a shadowed slab,
  the trash is a 28px radius-4 action going site-red `#e22134` on hover like
  `.lib-del`, and the close button matches the app's circular
  `rgba(255,255,255,.06)` icon buttons.

  Adapted rather than copied: the demo reserves about 418px of stage so opening
  never moves the page, which would leave a permanent hole in this sticky
  header, so here the card grows downward and pushes the results instead (no
  "rise"); motion is CSS transitions on the same curves (.56s morph,
  ease-out tweens) instead of framer-motion; the four demo items are replaced
  by real recents.

  The X button folds the card back to the compact search field on pointer down
  and clears the query in the same click: `scDismiss()` empties the input,
  resets the results to the empty state, then folds, so one press returns the
  bar to rest. The click handler runs the same path for keyboard activation,
  and both are idempotent (the second call finds nothing left to clear and a
  card already closed). Escape still clears a non-empty query first, then folds
  the card on the next press. The compiled script URL is versioned so browsers
  load the updated handler.

  Uncommitted on `development`: `web/templates/index.html`,
  `web/static/style.css`, `web/ts/app.ts`, plus the rebuilt
  `web/static/app.js`. Verified with `npm run build`, `python3 -c "from app
  import app"`, and headless Firefox screenshots of the real markup running the
  real compiled `app.js`: the closed field, the open card with 5 rows plus the
  hover sheet and trash on row 2, the empty state (no recents, action button
  hidden), the two filter states (`zzz` hides every row and shows
  `No results for "zzz"`, `ad` leaves only `adhan` and the card shrinks to fit),
  the mobile layout (kbd hidden, full-width card), and the X path (open, type
  `adhan`, fire the X handlers) which comes back byte-identical to the resting
  closed state, so the query really is gone and the bar really did fold. No
  console errors in any of them. The preview harness was also fixed along the
  way: it appended a second `<script src="/static/app.js">`, so every page
  threw `SyntaxError: redeclaration of let discordEnabled` on load; the
  generator (`/tmp/opencode/gen_preview.py`) now inserts its seed before the
  app's own tag. Screenshot round one caught a real bug: `scSetBody` measured
  with `scrollHeight` and only released to `auto` after 460ms, so shrinking the
  list inside that window (typing immediately after focusing) left the card at
  its old height with a dead band under the chips. It now measures the body's
  children directly and re-syncs the height whenever the list changes while the
  explicit height is still set, so the card stays snug.

- [x] Release notes are GitHub-only, the in-app card is gone: a `#set-notes`
  block in the Updates card (backend `body` passthrough, `renderReleaseNotes`
  markdown-lite renderer, `.rel-notes` styling) was built and verified, then
  removed at the user's request in the same session. `/api/updates` no longer
  returns `body` and `UpdateRelease` has no body field. Do not rebuild it
  without asking; the description belongs on the GitHub Releases page.
  Removed cleanly with `git revert --no-commit 2029bbe`, rebuilt `app.js` (no
  drift) and confirmed no `set-notes` / `rel-notes` / `renderReleaseNotes`
  references remain.
- [x] Android runtime test in `release.yml`, green in run 40440166178
  (job added in `884b39c`, test body moved to
  `.github/scripts/android-runtime-test.sh` in `c286c72`). The
  `android-runtime-test` job needs `build-android`, runs only on tag/dispatch
  like the rest of the pipeline, gates `release`, needs no signing secrets and
  so stays out of the `android-signing` environment. It enables KVM, sets up
  Java 17 plus platform-tools, downloads the `android-apk` artifact and runs an
  API 34 x86_64 emulator with
  `reactivecircus/android-emulator-runner@a421e438` (v2.38.0, SHA-pinned like
  every other action). All checks passed on the run: the universal APK
  installs with `adb install -r`, `com.goldstac.quran/.MainActivity` starts and
  the process stays alive, the in-app Rust server answers `/` and
  `/api/library` on `127.0.0.1:5000` through `adb forward` about 5s after
  launch, `uiautomator dump` sees real app text so the WebView really left the
  loading page (it fails if the tree still says "Starting Quran" or "Could not
  reach the local server", warns if the tree cannot be read), `logcat -b crash`
  has nothing for the package, and after `am force-stop` the server stops
  answering. The first attempt failed for a workflow reason, not an app one:
  `android-emulator-runner` runs its `script` input line by line as separate
  `sh -c` shells, so inline functions and shell variables never survived, hence
  the script file. The whole test takes about 30s once the emulator is up.
- [x] Hidden-from-Discord nasheeds now persist across reloads (`5408ab5` on
  `development`, `AGENTS.md` updated with it). The eye button's id list only
  lived in localStorage `ns_discord_hidden`, so a webview site-data reset (the
  same failure that made the presence toggle forget itself, fixed in `3cb16a4`)
  or a switch between the app window and the browser (separate origins, so
  separate storage) threw the hides away. The list now also lives in
  `~/.local/share/quran-app/discord.json` next to `enabled`: `POST
  /api/discord/hidden {ids}` writes it (strings, max 64 chars, 500 entries,
  400 on a non-list), `GET /api/discord/status` returns `hidden`, and
  `initDiscord` adopts the server list on load (or seeds the server from
  localStorage when the file has no list yet), guarded by a `discTouched` flag
  so a click during startup is not clobbered, with rows repainting their eye
  icons once the list arrives. `pagehide` still never touches the file.
  Verified: `python3 -c "from app import app"`, `npm run build`, a Flask
  test-client script covering merge/400/cap/malformed-file cases, and a jsdom
  harness running the real compiled `app.js` against a live backend on port
  5001: 12/12 checks twice in a row, including "wipe localStorage, reload, eye
  is hidden again". Not in the release yet: dispatch `release.yml` on
  `development` before the next tag.
- [x] Terminal startup logging for the desktop app (`823f0ac` on
  `development`). Running `./Quran_*.AppImage` from a terminal prints a
  startup banner (name, version, one-line description, Linux note that
  GTK/GLib warnings below are harmless), step-by-step progress ("Starting
  local backend: <path>", "Backend running on http://127.0.0.1:<port>",
  "Opening the app window. Close it to quit.") and clear errors when the
  backend binary is missing, fails to spawn, or never answers. The Rust side
  also forwards the backend's stdout/stderr to the terminal; the backend
  prints its version and data folder on startup and quiets werkzeug request
  logs when frozen (dev runs keep them, real errors still show either way).
  Files: `tauri-app/src-tauri/src/lib.rs`, `web/app.py`. Verified: `cargo
  check` and the Python import/banner. Still worth one real
  `./Quran_*.AppImage` run to eyeball the banner before the next tag ships it.
- [x] Security audit of the whole stack, then every finding fixed in its own
  commit (user's call, Oct 26). The root cause behind most of it: `CORS(app)`
  wildcard plus zero authentication on a server that also bound `0.0.0.0`, so
  any page the user visited (or any device on the LAN) could drive every API.
  Twelve commits on `development`:
  - `3f4a69a` wildcard CORS removed (the frontend is same-origin), a
    before_request guard rejects non-loopback Host and non-app Origin (tauri
    origins allowed), the server binds 127.0.0.1 unless `QURAN_BIND` says
    otherwise (that opt-in disables the guard and is documented as a
    trusted-network mode), and flask_cors left requirements, the sidecar
    build, and the docs.
  - `e35ced9` `/api/library/add` and playlist add rebuild a fresh object
    from an allowlist (strict `[A-Za-z0-9_-]{1,64}` id, typed and capped
    strings, http(s)/local-path thumbnail and url, no filepath/artfile/
    kind/stream_url passthrough), and `song_file_path` only honours paths
    inside `downloads/` or `local/`, never elsewhere in the data dir.
  - `9e9df67` `library.json` is written to a temp file and renamed over, so
    a crash mid-write cannot truncate it.
  - `bfb181c` frontend escaping: `esc()` now escapes quotes too, row
    `duration_string`, ayah counts, chapter numbers and badges go through
    it, thumbnails load only from a local path or http(s) via `thumbSrc()`,
    the inline `onerror` became a listener (a strict CSP would have blocked
    it), selectors use `CSS.escape`, and ids are url-encoded in api paths;
    `app.js` rebuilt.
  - `ef4708c` Flask serves a CSP on html responses: `script-src 'self'`
    (no inline), `connect-src 'self'`, images limited to local art plus the
    youtube thumbnail hosts, styles/fonts from the two cdns already in use,
    frames/objects/base/forms locked down.
  - `1abea5f` yt-dlp concurrency capped (4 interactive with a busy
    response, downloads queued 2 at a time), stream cache lru-capped at 64
    and the quran api cache at 96, request bodies limited to 2 GB.
  - `c94f8e5` the bot url must be http(s) with a real hostname and no
    userinfo, is revalidated before test/link/report use, bot responses
    are read with a 64 KB cap, and the link error string is truncated.
  - `6971bc4` the updater carries the sha256 digest GitHub publishes per
    release asset and refuses to apply (and deletes) a download that does
    not match it.
  - `1e4bd3e` every `uses:` line in release.yml pinned to a full commit
    sha (10 unique actions, original tag kept as a comment).
  - `a8ead7f` build-android runs behind `environment: android-signing`;
    add required reviewers under Settings > Environments so the gate
    actually asks a human before the keystore is exposed.
  - `30ad505` the wrapper only navigates to a port whose `/api/version`
    returns a json string version, and its ureq probes have a 2s timeout
    (they had none, so a silent squatter could hang startup).
  - `951e632` sidecar discovery no longer checks `./dist` in the current
    working directory (exe_dir plus the compile-time repo paths cover
    every real layout), so running the binary from an untrusted folder
    cannot load a planted backend.
  Verified: `python3 -c "from app import app"` after every backend commit,
  `npm run build` with a clean `git diff` on `app.js`, `cargo check` green
  (re-run incrementally after the last edit), python json parse of
  tauri.conf.json, and the local cargo `target/` was cleared (1.6G freed;
  it came back briefly for the cargo check). Judged acceptable as-is: the
  `starts_with` prefix match in `find_candidate_binary` (externalBin names
  the binary `quran-backend-<triple>`, so prefix matching is required) and
  the QURAN_BIND mode (explicit opt-in, guard off by design). Not yet run:
  the full release workflow; dispatch it on `development` before the next
  tag so the pinned actions and the new environment are exercised for
  real.

- [x] `v1.2.1-pre-alpha.2` released (Oct 25, marked pre-release, run
  40212285551 green on validate, all three desktop builds, both runtime
  tests, android, and the release job). Assets: universal APK (45.8M),
  AppImage (149.6M), x64 setup.exe, amd64 deb, aarch64 dmg; installers
  are named `Quran_1.2.1_*` (the stamp touches package.json/Cargo.toml,
  not tauri.conf.json, same as pre-alpha.1) while the binaries report the
  full `1.2.1-pre-alpha.2` via `QURAN_VERSION`. Two CI bugs from b14e29c
  were caught and fixed on the way: (1) `tauri.android.conf.json` had a
  top-level `"android"` block, but the schema only accepts
  `bundle.android` (key needs CLI >= 2.9.0; repo pins 2.11.5), so Build
  android died at config validation on every dispatch and tag - nested it
  under `bundle` in `5987606`, no packaging/manifest/signing change, so
  the Redmi A5 investigation was untouched; (2) the android-only
  `Stamp prerelease version` step imported `os, re, sys` but called
  `json.load`, dying with NameError - it only runs on refs containing a
  dash, which is exactly why the `development` pre-check never exercised
  it, fixed as `import json, os, re, sys` in `fb64198`. Release
  discipline held: dispatch pre-check first (green after fix 1), tag
  second; the first tag run (40210649027) failed only on bug 2 and
  published nothing (release job skipped), so with user go-ahead the
  minutes-old tag was deleted and re-cut onto `fb64198`. Remember: the
  pre-check on `development` cannot test tag-only (`contains(github.ref_name,
  '-')`) steps, so stamping logic stays unproven until a tag run.

- [x] Embedded cover art for imported nasheeds. If an uploaded file carries
  cover art in its tags (ID3 APIC, FLAC pictures, MP4 covr, ogg/opus
  metadata_block_picture), `POST /api/local` extracts it, shrinks it to a
  max 512px JPEG with Pillow (a 900x700 source came out 512x398, 8.5KB) and
  stores it as `local/<sid>.art.jpg`; the song's `thumbnail` points at the
  new route `/api/local-thumb/<sid>` (path-checked inside LOCAL_DIR, 404
  for unknown ids). `api_remove` deletes the art file with the song;
  `delete_song_file` stays untouched because download-remove keeps the
  song. No frontend work was needed: rows, `#player-thumb`, and the
  media-session artwork already render `song.thumbnail` and fall back to
  the music-note placeholder when it is empty. A `backfill_local_art()`
  pass at import fills art and duration (mutagen now installed, also gives
  local songs their `duration_string`) for songs added before this; the
  user's existing nasheed now reads `2:40` and has its art. Verified with
  `/tmp/opencode/domtest/arttest.py` (upload with embedded 900x700 art,
  endpoint serves image/jpeg, removal deletes the file) and `artrun.js`
  (jsdom against a throwaway server on port 5077: the row is an IMG with
  the right src, fetch 200, art file gone after delete, zero JS errors).
  Still open: restart the backend to serve the new route (the running
  server is from 23:01), and commit `web/app.py`.

- [x] "Your Nasheeds" upload did nothing (user report, Oct 24; app-side
  part committed as `8d30b16`). Root cause was system-level, not the app:
  the user's Brave is the `com.brave.Browser` flatpak, and flatpak picks
  are handed into the sandbox by `org.freedesktop.portal.Documents`, whose
  database `~/.local/share/flatpak/db/documents` had been truncated to 0
  bytes on Oct 21 18:33 (the disk-full episode; disk still at 97%), so
  `xdg-document-portal.service` crash-looped with "invalid gvdb header" on
  every activation. The journal caught both attempts (22:33:34 and
  23:02:06, `Failed to register .../have-you-really-departed-oh-our-sheykh.mp3`):
  the picker opened and the file was chosen, the sandbox export failed, the
  input ended up with zero files, and `addLocalFiles` returned silently at
  `if (files.length)` - no toast, no POST, nothing in `local/`. Fixed by
  deleting the 0-byte DB and starting the unit (now active, owns its bus
  name `:1.438`); the user retried and confirmed the upload works. App-side
  hardening shipped in the same window: real error toasts (404 = backend
  out of date, the backend's own error text, or "can't reach the backend")
  instead of a blanket "failed", plus the guarded `.yt-act` listener so
  local rows render. Full end-to-end proven with a jsdom harness running
  the real `web/static/app.js` against the live server. Follow-up: the disk
  at 97% (2.0G of 53G) is what corrupted the portal DB;
  `tauri-app/src-tauri/target/` (1.6G) is regenerable build output if
  `cargo clean` is ever wanted.

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
