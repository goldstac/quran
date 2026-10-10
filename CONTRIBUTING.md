# Contributing

Thanks for helping out! This project is small and friendly, here's all you really need to know.

## Before anything else

Read **[AGENTS.md](AGENTS.md)**, it's the single source of truth for conventions, commands, and gotchas (port 5000 habits, the proxy rules, wording preferences, etc).

## Getting set up

```bash
# backend deps (Arch needs --break-system-packages)
pip install flask flask-cors

# yt-dlp must be on PATH
yt-dlp --version

# frontend toolchain
npm install
npm run build
```

Run it:

```bash
./run-web.sh    # http://localhost:5000
```

Tip: free the port first if an old instance is hanging around: `fuser -k 5000/tcp`.

## Making changes

- **Frontend source of truth is `web/ts/app.ts`.** After editing, run `npm run build` (or `npm run watch`). The generated `web/static/app.js` is committed but never edited by hand.
- **Backend is `web/app.py`.** Keep `if __name__ == "__main__":` pinned to the very bottom of the file, or routes added below it silently won't register.
- **Verify before you finish:**
  ```bash
  npm run build
  cd web && python3 -c "from app import app"
  ```
- Don't start background servers on port 5000, it blocks whoever's running the app for real.

## Style & conventions

- Say **"nasheeds"**, never "songs", in anything user-facing.
- Display name is **Quran** (repo slug is `quran`), internal ids are all `quran-*` (package `quran-player`, binary `quran`, identifier `com.goldstac.quran`, data dir `quran-app`).
- No code comments unless you're asked for them.
- No browser `prompt()` / `confirm()` / `alert()`, use the existing custom modal helpers (`promptText`, `confirmDialog`, `showPlaylistPicker`).
- Any in-app search or list picker should reuse the reciter picker's look (`showReciterPicker()`): a modal with a live-filtering search input, an "x of n" count, and a selectable option list.
- No stock `<input type="range">`, use the custom `Slider` component.
- UI work should match the existing flat Spotify-dark theme (`#121212` / `#181818` / `#1db954`, Inter font).
- Keep `PRIVACY.md` and `TERMS.md` honest, if your change alters what data exists or where traffic goes, update them in the same PR.
- Docs tone: plain and casual. Please keep heavy legal/rule language out of the docs.

## Commits & PRs

- **Conventional Commits**: `<type>(<scope>): <description>`, e.g. `fix(loop): replay on ended instead of refetching`, `feat(ui): add shuffle play button`.
  - types: `feat`, `fix`, `refactor`, `docs`, `style`, `perf`, `chore`, `build`
  - scopes: `web`, `api`, `player`, `ui`, `loop`, `tauri`, …
- Keep PRs focused, one idea per PR.
- In the PR/issue description, say what you changed and how you verified it (build clean, python import check, what you clicked through).
- Don't force-push or rewrite shared history.

## Please don't (unless you've asked first)

- Re-add the Downloads feature, it was removed on purpose.
- Change loop back to a 3-state cycle, off↔one is deliberate.
- Rename/restructure things "for cleanliness" without checking AGENTS.md first.

## Issues

Open an issue with: what you did, what you expected, what happened instead, plus your OS/browser and anything in the console/terminal. Search existing issues first so we don't double up.

## Discussions

Got a question, idea, or just want to talk about the project? Use [GitHub Discussions](https://github.com/goldstac/quran/discussions) instead of an issue. Issues are for bugs, discussions for everything else.
