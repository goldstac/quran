# AGENTS.md

This file helps AI agents work efficiently in this repo. Read it before making changes.

## Project Overview

An all-in-one open source Islamic app (Quran + nasheeds), desktop/mobile, Spotify-like player. Display name is **Quran** (the app is literally named "Quran"; repo slug `quran`) (no "songs" branding, the user insists on **nasheed** terminology). Internal ids are all `quran` (package `quran-player`, binary `quran`, identifier `com.goldstac.quran`, data dir `quran-app`); a legacy `nasheed-app` data dir is auto-renamed on first run. The word "nasheeds" (the content) stays everywhere in UI copy. It searches YouTube via `yt-dlp`, streams audio through a local proxy, manages a persistent library, favorites, and playlists, and plays Quran audio direct from CDN with reciter selection. NOTE: downloads were removed by user request ("what the point of it") — do not re-add them without asking.

Two app versions exist in this repo:
- **`web/`** — active Flask + TypeScript/CSS web app (the one being developed)
- **`tauri-app/`** — desktop app for testing (Tauri v2): Rust spawns `python3 web/app.py` on startup and keeps its **stdin pipe open** the whole time; the backend watches that pipe for EOF (`QURAN_STDIN_WATCH=1`) and exits when the app closes, so no orphaned backend survives. The window loads `http://127.0.0.1:5000` via a loading page. Android (APK) is planned later.

## Commands

- Run the web app: `./run-web.sh` (starts Flask on `http://localhost:5000`)
- Build frontend TS → JS: `npm run build` (from repo root; compiles `web/ts/app.ts` → `web/static/app.js`). Use `npm run watch` during dev.
- Build the desktop binary: `cargo build --release` (in `tauri-app/src-tauri/`) → `target/release/quran` (gitignored). Run it directly; it spawns the Flask backend itself. If the backend lives elsewhere, set `QURAN_WEB_DIR`. If port 5000 is already held (e.g. `run-web.sh` running), it just connects to the existing server.
- No test suite, no linter configured. Verify Python loads cleanly before finishing: `python3 -c "from app import app"` (run from `web/`)
- CI validation: push to `development`, then `gh workflow run release.yml --ref development`. The workflow builds all three platforms and has a `runtime-test` job that launches the packaged Windows/macOS apps, checks the backend on `127.0.0.1:5000`, and confirms the backend exits when the app is killed. Never release (tag push) until it passes.

## Git & Conventional Commits

- Remote: `origin` at `git@github.com:goldstac/quran.git`, default branch `main`.
- ALWAYS use Conventional Commits. Format: `<type>(<scope>): <description>`
- Types: `feat` (new feature), `fix` (bug fix), `refactor`, `docs` (docs/AGENTS), `style` (CSS-only, no logic), `perf`, `chore` (gitignore, tooling), `build`.
- Scope examples: `web`, `api`, `player`, `ui`, `loop`, `tauri`. Use lowercase.
- Examples:
  - `fix(loop): replay current nasheed on ended instead of refetching`
  - `feat(api): add range-aware audio proxy for seeking`
  - `style(ui): restyle player bar to spotify-dark theme`
- Only commit when the user explicitly asks. Stage only intended files (`git add <file>`), never secrets. Inspect `git status` / `git diff` before committing. Do not update git config or force-push.

## Critical Gotchas

1. **Port 5000 usage**: `./run-web.sh` will fail with "Address already in use" if anything else holds port 5000. Free it with `fuser -k 5000/tcp` before running. Do NOT start a background test server that holds port 5000 — the user runs the app themselves and gets blocked.
2. **`app.py` run block position**: The `if __name__ == "__main__": app.run(...)` block MUST remain at the BOTTOM of the file. If you append routes after it, they never register when run directly (only when imported). This caused a hard-to-find 404 on `/api/proxy` once.
3. **YouTube direct playback is blocked**: Browsers cannot play raw YouTube stream URLs. All playback MUST go through `/api/proxy/<video_id>`, which resolves a fresh URL via `yt-dlp -g`, caches it per video_id (`_stream_cache`), forwards `Range` headers (needed for seeking), and returns `206 Partial Content`. Clears cache entry on upstream error (expired URL).
4. **Loop feature (user's top priority)**: it kept "not working". Current behavior — loop button toggles only `off` ↔ `one` (repeats current track by doing `audio.currentTime = 0; audio.play()`). There is NO "loop all" anymore by design; the user explicitly wanted single-click = repeat current nasheed. Do not bring back the 3-state cycle without asking.
5. **Loop "one" must NOT re-fetch the stream URL** on the `ended` event — just replay `audio.currentTime = 0`. Re-fetching was the original bug (stale/expired URLs + autoplay blocking).
6. **`play()` rejections must be caught** and surfaced (toast `'Click play to start'`); a silent `.catch(()=>{})` hides autoplay-policy failures.
7. **Players served through proxy only**: `/api/stream` returns JSON metadata, but the `<audio>` element must use `/api/proxy/<id>` for its `src`.

## File Map (web app — the important one)

- `README.md` / `CONTRIBUTING.md` — project overview & contributor guide. Keep them in sync with real commands/conventions (AGENTS.md remains the detailed source of truth).
- `PRIVACY.md` / `TERMS.md` — privacy policy and terms of service (plain-language, jurisdiction-neutral). Must stay truthful to what the app actually does (local-only storage, no developer servers, third-party requests to YouTube/Google Fonts/cdnjs). Keep the tone casual — the user dislikes heavy legal/rule language (minimal mention of laws/rights). Update both if data/network behavior changes.

- `web/app.py` — Flask backend. All `/api/*` routes: search, stream, proxy (audio), library (add/fav/remove), playlists (create/add/remove/delete/rename — delete/rename take POST body `{name}` / `{old,new}`), version (`/api/version`). Persists to `~/.local/share/quran-app/library.json` (auto-migrates from the old `nasheed-app` dir). Two optional env vars: `QURAN_VERSION` (set by the desktop app; falls back to `package.json`) and `QURAN_STDIN_WATCH=1` (starts a thread that exits the process when its stdin pipe hits EOF — how the desktop app prevents orphaned backends).
- `web/templates/index.html` — single-page layout: sidebar (nav + playlists + muted `#sidebar-ver` version footer), main (search/view/library/settings views), bottom player bar. Sliders are empty `<div id="progress-bar"|volume-bar>` containers — NOT `<input type=range>`. They are turned into the custom `Slider` widget by TS.
- `web/static/style.css` — all styling (no Tailwind). Calm dark theme: `#0f1311` bg with soft green/gold radial glows, translucent blurred sticky headers, gradient sidebar/player. Accents: green `#1db954` (nasheeds, controls) and gold `#c9a86c` (Quran reading: ayah numbers, active ayah, translation label/toggle). Fonts: Inter (UI), Lora (translation text), Noto Naskh Arabic (Arabic names) via one Google Fonts import, plus Font Awesome. Slider visuals use `.slider`/`.slider-env` (grey track) `.slider-fill` (green, white for volume) `.slider-thumb` classes.
- `web/ts/app.ts` — ALL frontend logic in TypeScript (navigation, search, rendering, playback, keyboard shortcuts, toasts). Contains the `Slider` class (pointer-event driven, `onInput`/`onChange` callbacks; thumb shows on hover/focus/drag) and typed `Song`/`Playlist`/`Library` interfaces. Compiled output goes to `web/static/app.js` — never edit that file directly, edit `web/ts/app.ts` and run `npm run build`.
- `package.json` / `tsconfig.json` — TS tooling (rootDir `web/ts`, outDir `web/static`).

## File Map (tauri-app — desktop test wrapper)

- `tauri-app/src-tauri/src/main.rs` — spawns `python3 app.py` (finds `web/` via `QURAN_WEB_DIR`, manifest-relative path, or `./web`), stores the child, kills it on `RunEvent::Exit`.
- `tauri-app/src-tauri/tauri.conf.json` — window config + CSP (allows `connect-src`/`media-src`/`img-src` to localhost); no `devUrl` so both dev and build serve the loading page.
- `tauri-app/src/index.html` — loading page: polls `http://127.0.0.1:5000/` (no-cors fetch) and redirects when up; shows an error after 30s.
- `tauri-app/src-tauri/icons/` — the app icon set (32/128/256 PNG, `.icns`, `.ico`), resized from the master logo `app_logo.png` at the repo root with ImageMagick. Regenerate from that master whenever the logo changes.
- Binary + `Cargo.lock`: binary is gitignored (`target/`, `quran`); commit `Cargo.lock` (it's an app, not a lib).

## Frontend Conventions

- **Source of truth is TypeScript**: all JS logic lives in `web/ts/app.ts` and compiles to `web/static/app.js`. After editing TS, run `npm run build` so changes take effect. Never hand-edit the compiled JS.
- **Sliders are a custom component, not browser inputs**: `<input type="range">` is banned. Use an empty container div with `role="slider"` and an `id`, then build it in TS with `new Slider($('#...'))`. The `Slider` class exposes `setValue(v)` and `onInput`/`onChange` callbacks. Progress reads at 250ms interval into `seek.setValue(p)`; volume reads `vol.getValue()`. Keyboard support built in (←/→, PageUp/Down, Home/End).
- **Class names**: sidebar = `sidebar`, `nav-item`, `pl-item`; track rows = `track-row`, `track-thumb`, `track-name`, `track-channel`, `track-dur`, `track-actions`, `track-act` (with `play-act`/`fav-act`/`pl-act` variants); player = `player-*`, controls `ctrl` / `play-pause`; sliders = `.slider`, `.slider-env`, `.slider-fill`, `.slider-thumb`; toasts = `.toast`.
- **Rendering**: rows are created by `makeRow(song, idx, ctx)` in `app.js`. Click handlers: single-click on row-actions buttons, `dblclick` on row to play.
- **State**: `queue` / `queueIdx` / `loopMode` / `currentSong` / `currentList` are module-level `let`s. `currentList` must be set whenever a list renders (so loop/next/prev have a queue from any view — search, library, favorites, playlist).
- **Toasts**: use the `toast(msg)` helper for user feedback (like, download, loop, playlist actions).
- **Keyboard shortcuts**: Space = play/pause, ←/→ = seek, Shift+←/→ = prev/next, ↑/↓ = volume, L = loop, M = mute, / or S = focus search.
- **Spotify QoL behaviors** (keep these intact when editing):
  - **Shuffle**: player-bar `#shuffle-btn` toggles `shuffleOn` via `setShuffle(on)`; when on, starting a track builds `queue = [current, ...shuffled rest]`; toggling off restores `preShuffleQueue`. Header `#shuffle-play-btn` = play list shuffled. Persisted (`ns_shuffle`).
  - **Auto-advance**: track `ended` plays the next queue item (unless loop one); stops (`resetPlayer`) at queue end. `nextTrack` likewise stops at end (no wrap). `playSong(..., keepQueue=true)` is used for queue-internal moves so the queue is NOT rebuilt.
  - **Loop** is off↔one only, persisted (`ns_loop`).
  - **Recently Played** nav view reads localStorage `ns_recent` (cap 50, recorded in `playSong` via `recordRecent`). **Recent search chips** (`#recent-q`) read `ns_recentq` (cap 8, saved in `doSearch`); chips show only while the search input is empty.
  - **Library**: header has green Play (`#pl-play`) + shuffle-play, sort dropdown (`#lib-sort`, modes added/title/channel, persisted `ns_sort`), rename (pencil, playlists only). `loadLib` sets `currentLibMode`/`currentLibSource` (library/favorites are reversed to newest-first). Rows in library contexts get a trash (`rem-act`) → `removeFromList` (playlist context removes from that playlist, otherwise from library) — search-result rows have no trash.
  - **Media Session API** metadata + play/pause/prev/next handlers (guarded by `'mediaSession' in navigator`).
  - **Seek tooltip** (`#progress-bar .seek-tip`) shows timestamp on hover.
  - **Volume** persisted (`ns_vol`), restored on load.
  - **Settings** view (`#settings-view`, reached via the `settings` nav item): app version (`#set-version` from `/api/version`), GitHub repo + latest release ("Check for updates" calls the GitHub API directly), and a default-volume slider (`#settings-volume-bar`, synced with the player `vol` slider). The sidebar footer `#sidebar-ver` shows the version too (`loadSidebarVersion`).
  - All persisted keys live in localStorage with the `ns_` prefix; use the `store(key,val)` / `load<T>(key,fallback)` helpers.
- **User-facing language**: use "nasheeds", never "songs" in UI text (e.g. "Liked Nasheeds").
- **No em dashes** in any user-facing text (UI, docs, release notes, README/TERMS/PRIVACY). Use commas, periods, semicolons, or " - " instead.
- **No browser dialogs**: `prompt()`, `confirm()`, and `alert()` are banned — build custom modals instead. Use `Modal` (wireframe: `modal-backdrop`/`modal`/`modal-title`/`modal-body`), `promptText(title, placeholder, okLabel, value?)` for text input (returns `Promise<string | null>`, `value` prefills — used for rename), `confirmDialog(title, message)` for yes/no (returns `Promise<boolean>`), and `showPlaylistPicker()` (lists playlists, "New playlist" flow creates then returns the name) for adding nasheeds to playlists.
- **Do NOT add code comments** unless asked.

## Backend Conventions

- Python 3.11+, Flask + `flask_cors`. Installed with pip via `--break-system-packages` (Arch).
- `yt-dlp` binary is at `/home/admin/.local/bin/yt-dlp` (on PATH).
- Subprocess calls to yt-dlp must include `--no-warnings --no-playlist` and a timeout.
- Library is JSON at `~/.local/share/quran-app/library.json` with shape `{"songs":[...], "playlists":[{"name","songs":[]}]}`. Songs have `id`, `title`, `channel`, `thumbnail`, `duration`, `duration_string`, `url`, `favorite` (bool), `filepath`.
- `/api/version` returns the app version from a single source: `QURAN_VERSION` env var (set by the desktop app from `CARGO_PKG_VERSION`) if present, else the `version` field in `package.json`. Keep version bumps in sync across `package.json`, `tauri-app/src-tauri/Cargo.toml`, `Cargo.lock`, and `tauri.conf.json`.