#!/usr/bin/env python3
import json
import os
import platform
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST_DIR = ROOT / "dist"


def rust_target_triple() -> str:
    machine = platform.machine().lower()
    system = platform.system().lower()

    arch_map = {
        "x86_64": "x86_64",
        "amd64": "x86_64",
        "arm64": "aarch64",
        "aarch64": "aarch64",
    }
    arch = arch_map.get(machine, machine)

    if system.startswith("linux"):
        return f"{arch}-unknown-linux-gnu"
    if system.startswith("darwin"):
        return f"{arch}-apple-darwin"
    if system.startswith("windows"):
        return f"{arch}-pc-windows-msvc"
    raise RuntimeError(f"Unsupported platform: {system} {machine}")


def get_latest_ytdlp_release() -> dict:
    """Fetch the latest yt-dlp release info from GitHub."""
    url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest"
    req = urllib.request.Request(url, headers={"User-Agent": "quran-app-builder"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_ytdlp_download_url() -> str:
    """Get the download URL for the yt-dlp standalone binary for this platform."""
    release = get_latest_ytdlp_release()
    assets = release.get("assets", [])

    system = platform.system().lower()
    machine = platform.machine().lower()

    candidates: list[str]
    if system.startswith("linux"):
        if "aarch64" in machine or "arm64" in machine:
            candidates = ["yt-dlp_linux_aarch64", "yt-dlp_linux_arm64"]
        else:
            candidates = ["yt-dlp"]
    elif system.startswith("darwin"):
        if "aarch64" in machine or "arm64" in machine:
            candidates = ["yt-dlp_macos_arm64", "yt-dlp_macos_aarch64"]
        else:
            candidates = ["yt-dlp_macos", "yt-dlp_macos_intel"]
    elif system.startswith("windows"):
        candidates = ["yt-dlp.exe"]
    else:
        raise RuntimeError(f"Unsupported platform: {system}")

    for name in candidates:
        for asset in assets:
            if asset["name"] == name:
                return asset["browser_download_url"]

    raise RuntimeError(f"Could not find yt-dlp binary for {system} {machine} in latest release")


def download_ytdlp(url: str, dest: Path) -> None:
    """Download yt-dlp binary from the URL."""
    print(f"Downloading yt-dlp from {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "quran-app-builder"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        with open(dest, "wb") as f:
            f.write(resp.read())
    os.chmod(dest, 0o755)
    print(f"Downloaded to {dest}")


if __name__ == "__main__":
    DIST_DIR.mkdir(exist_ok=True)

    target_triple = rust_target_triple()
    sidecar_name = f"yt-dlp-{target_triple}"
    if platform.system().lower().startswith("windows"):
        sidecar_name += ".exe"

    sidecar_path = DIST_DIR / sidecar_name

    try:
        url = get_ytdlp_download_url()
        download_ytdlp(url, sidecar_path)
        print(f"Built yt-dlp sidecar at: {sidecar_path}")
    except Exception as e:
        print(f"Error building yt-dlp sidecar: {e}", file=sys.stderr)
        sys.exit(1)
