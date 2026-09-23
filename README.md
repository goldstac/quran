# Nasheed Player

A Spotify-style desktop/mobile player for Islamic **nasheeds**. Search YouTube, play audio through a snappy local player, and keep your own library, likes, and playlists — all stored on your device.

> Web app is the active version (`web/`). A Tauri desktop wrapper is stubbed out, Android is planned, and the old GTK4 app in `core/`/`ui/` is legacy.

## Features

- **Search YouTube** for nasheeds (via `yt-dlp`), with debounced live results
- **Smooth playback** through a local proxy — seeking/scrubbing works (Range-aware streaming)
- **Custom UI components** — hand-built seek/volume sliders and modals, no stock browser widgets, flat Spotify-dark theme
- **Your Library** — auto-saves what you play; likes ("Liked Nasheeds"), playlists with create / rename / delete, per-row remove
- **Shuffle** (restores original order when toggled off) and **loop-one**; queue **auto-advances** when a track ends
- **Recently Played** view + **recent search chips**
- **Sort** library by recently added, title, or channel
- **Keyboard shortcuts** (below), toast notifications, Media Session (lock-screen/OS media keys)
- **Everything persists locally** — volume, loop/shuffle/sort, recents, library, playlists

## Requirements

- Python 3.11+ with `flask` and `flask-cors`
  - Arch/Manjaro: `sudo pip install --break-system-packages flask flask-cors`
  - elsewhere: `pip install flask flask-cors`
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) on your `PATH`
- Node.js 18+ (only needed to build the TypeScript frontend)

## Quick start

```bash
./run-web.sh
```

Then open **http://localhost:5000**.

If the port is busy (say, from an old run): `fuser -k 5000/tcp`

## Developing the frontend

The frontend source is **TypeScript** in `web/ts/app.ts`; it compiles to `web/static/app.js` (which Flask serves). Never hand-edit the compiled file.

```bash
npm install       # first time
npm run build     # compile once
npm run watch     # recompile on save
```

Sanity-check the backend before you finish:

```bash
cd web && python3 -c "from app import app"
```

Your data lives in `~/.local/share/nasheed-app/library.json` plus browser `localStorage` (keys prefixed `ns_`).

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `←` / `→` | Seek 5s |
| `Shift+←` / `Shift+→` | Previous / next track |
| `↑` / `↓` | Volume |
| `L` | Toggle loop (off ↔ repeat one) |
| `M` | Mute |
| `/` or `S` | Focus search |
| `Esc` | Clear search |

## Project layout

```
web/            the active Flask + TypeScript/CSS app
  app.py            backend: search, audio proxy, library & playlist APIs
  ts/app.ts         all frontend logic (compiled -> static/app.js)
  static/style.css  Spotify-dark theme
  templates/        single-page layout
tauri-app/      desktop wrapper stub (Tauri)
core/, ui/,     legacy GTK4 desktop app — deprecated,
main.py           new work goes in web/
AGENTS.md       repo conventions — read before making changes
PRIVACY.md      what the app does (and doesn't) do with your data
TERMS.md        terms of service
```

## Privacy

The app runs entirely on your device — no accounts, no servers of ours, no analytics. Your library never leaves your machine; YouTube and two CDNs (fonts/icons) see normal traffic. Full details: [PRIVACY.md](PRIVACY.md). Terms: [TERMS.md](TERMS.md).

## Contributing

PRs and issues welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Ownership

Code, interface, and docs belong to the project maintainer; nasheeds belong to their creators. See [TERMS.md](TERMS.md).
