# Privacy

**Applies to:** the Quran app in this repository (web version, and any desktop/mobile builds made from it). Repo: [github.com/goldstac/quran](https://github.com/goldstac/quran)

Plain and simple: here's what the app does.

## On your device

- Your library, likes, and playlists are a JSON file: `~/.local/share/quran-app/library.json`
- The browser keeps a few settings locally (`ns_` keys): volume, loop/shuffle/sort, recents, last searches
- There is no server of ours in the picture at all: nothing you play, like, or search for is ever sent to us

## Out on the network

All requests go straight from your machine to:

- **YouTube** (via `yt-dlp`) — nasheed searches, audio streaming, thumbnails
- **Quran.com** and **MP3Quran** — ayah text and translations, reciter lists, Quran audio
- **Google Fonts** and **cdnjs/Cloudflare** — interface fonts and icons
- **GitHub API** (`api.github.com`) — only when you click "Check for updates" in Settings, to look up the latest release

That's the full list. No accounts, no analytics, no cookies, no tracking.

## Deleting everything

Delete playlists/nasheeds in the app, remove `library.json`, and clear site data, or just uninstall. Everything lives on your device, so that's all it takes.

Our **Terms of Service** are in the separate file `TERMS.md`.
