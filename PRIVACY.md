# Privacy Policy

**Effective date:** 23 September 2026
**Applies to:** the Quran & Nasheeds app in this repository (web version, and any desktop/mobile builds made from it)
**Maintainer:** [github.com/goldstac](https://github.com/goldstac)

This policy just describes what the app actually does. No filler.

## The short version

- The app runs **on your own device**. There are no developer-operated servers, no accounts, no databases on our side.
- **We never see your data.** The app makes no requests to anything we control, because we don't run anything.
- There is **no analytics, no tracking, no advertising, no crash reporting** built into the app.
- Your library, playlists, and settings live **only on your device**.
- The app does talk to **YouTube/Google** (searches, audio, thumbnails) and to **two CDNs** that serve the interface's fonts/icons. Those parties see your connection like any other website traffic — under their own privacy policies, not ours.

## What we collect

**Nothing.** We don't receive, keep, or process anything about you — not your searches, not what you play, not your playlists, not when you use it. There's no server that could receive it.

## What's stored on your device

All of this is written to your own machine and stays there:

**Library file** — `~/.local/share/nasheed-app/library.json`:
- titles, channel names, thumbnail URLs, durations, and YouTube video IDs of nasheeds you've played or saved
- your liked/favourite flags
- playlist names and the nasheeds in them

**Browser local storage** (web version) — keys prefixed `ns_`:

| Key | Contents |
|---|---|
| `ns_recent` | your last 50 played nasheeds (metadata as above) |
| `ns_recentq` | your last 8 search queries |
| `ns_vol` | volume level |
| `ns_loop`, `ns_shuffle`, `ns_sort` | loop/shuffle/sort settings |

## Where your traffic goes

The app sends nothing to us. From your device it does make these outbound requests:

1. **Searches** — your query goes to **YouTube**, via the `yt-dlp` tool running locally. YouTube/Google sees your query, IP address, and the tool's user-agent.
2. **Audio** — streamed from Google's YouTube media servers (googlevideo.com), which see your IP and the media requests, same as any YouTube playback.
3. **Thumbnails** — loaded straight from YouTube's image servers (e.g. i.ytimg.com) by your browser.
4. **Interface assets** — two third-party hosts:
   - **Google Fonts** (`fonts.googleapis.com` / `fonts.gstatic.com`) — Google sees your IP and request.
   - **Font Awesome via cdnjs** (`cdnjs.cloudflare.com`) — Cloudflare sees your IP and request.

We don't control any of them. Their own policies apply:
- Google/YouTube: https://policies.google.com/privacy
- Cloudflare (cdnjs): https://www.cloudflare.com/privacy-policy

## Cookies and tracking

- The app sets **no cookies** and contains **no tracking or analytics** of any kind.
- The only storage it uses is the `localStorage` entries above, readable only by the app on that device.
- Your browser may cache streamed audio on disk as part of normal caching — that's your browser's cache, on your machine.

## Things worth knowing about your setup

- The local server listens on **all network interfaces** (`0.0.0.0`), not just localhost. Other devices on **your own Wi-Fi/router** may be able to open the app and see your library. It's not open to the public internet unless you port-forward it yourself. If your network isn't trusted, bind it to `127.0.0.1` instead.
- Search terms appear in URLs, so the **terminal running the app may print them** in its access log (e.g. `GET /api/search?q=…`). That log is only in your terminal, on your machine.

## Children

The app isn't aimed at children under 13 (or wherever your country sets the age for this sort of thing). Since nothing is collected at all, we have no way of knowing either way — and nothing of theirs reaches us regardless.

## Deleting everything

All of your data is local, so you're in full control:
- delete playlists/nasheeds from inside the app where available,
- clear the app/browser storage,
- or just uninstall the app.

Removing `library.json` and clearing site data wipes all of it. There's nothing on our side that needs deleting, because we never had anything.

## About third-party data

If you want to see, change, or remove what **YouTube/Google or Cloudflare** hold from the requests above, use their own privacy settings and policies (linked in section 4) — we have no access to any of it.

## Changes

Updates get committed to the project repository with a new effective date. Keep using the app after a change and that counts as acceptance of the updated version.

Our **Terms of Service** live in the separate file `TERMS.md`.
