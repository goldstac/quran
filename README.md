# Quran & Nasheeds

A local player for the **Quran** and Islamic **nasheeds**. Browse all 114 surahs with 170+ reciters, search YouTube for nasheeds, and keep your own library, likes, and playlists — everything stays on your device.

Cross-platform: **Linux, macOS, and Windows** — anywhere Python runs plus a browser. (macOS and Windows just need the same Python + `yt-dlp` setup below; all commands work the same.)

> Web app is the active version (`web/`). A Tauri desktop wrapper for testing lives in `tauri-app/`; Android is planned.

## Features

- **Quran** — all 114 surahs, pick from 170+ reciters, Arabic + English names, play/shuffle
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

If the port is busy: `fuser -k 5000/tcp` (Linux) or `lsof -ti:5000 | xargs kill` (macOS)

> Prebuilt desktop builds: grab a zip/tarball from the [Releases page](https://github.com/goldstac/quran-nasheeds/releases) (Linux, macOS, Windows) — unzip and run the binary (needs Python + `yt-dlp`, see `START.txt`).

## Self-hosting

Run it on your own machine (home server, NAS, always-on PC) and open it from any browser — no cloud, no accounts, your server is the whole backend.

**What the server needs:**
- Python 3.11+ with `flask` + `flask-cors`
- `yt-dlp` on the **server's** PATH (all searching/streaming happens there)
- No Node required — the compiled `web/static/app.js` is committed

```bash
git clone git@github.com:goldstac/quran-nasheeds.git
cd quran-nasheeds
pip install flask flask-cors        # Arch: add --break-system-packages
python3 web/app.py
```

The server already binds **all interfaces on port 5000**, so other devices on your network reach it at `http://YOUR_SERVER_IP:5000`.

**Change the port or bind address** — last line of `web/app.py`:

```python
app.run(host="127.0.0.1", port=8080, debug=False)
```

**Before you open it up — please read:**
- There is **no login**. Anyone who can reach your instance can play, like, create, rename, and delete playlists, and read your library.
- `library.json` (songs + playlists) lives on the **server** and is shared by everyone who connects; volume/recents/search history live in **each visitor's own browser**.
- Every search and stream goes out through your server's IP to YouTube.
- Safe options: stay on LAN, use Tailscale/WireGuard, or put real auth in front (proxy basic-auth, Authelia, etc.). Don't expose it raw to the internet.

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
tauri-app/      desktop app for testing (Tauri — spawns the web backend itself)
AGENTS.md       repo conventions — read before making changes
PRIVACY.md      what the app does (and doesn't) do with your data
TERMS.md        terms of service
```

## Privacy

The app runs entirely on your device — no accounts, no servers of ours, no analytics. Your library never leaves your machine. It talks to YouTube (nasheeds), Quran.com + MP3Quran (surahs/reciters/audio), and two CDNs (fonts/icons) for normal traffic only. Full details: [PRIVACY.md](PRIVACY.md). Terms: [TERMS.md](TERMS.md).

## Contributing

PRs and issues welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Ownership

Code, interface, and docs belong to the project maintainer; nasheeds belong to their creators, and Quran recordings belong to their reciters/rightsholders. See [TERMS.md](TERMS.md).
