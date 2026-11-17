#!/usr/bin/env python3
import hashlib
import os
import platform
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


YTDLP_VERSION = "2026.10.26"
YTDLP_SHA256 = {
    "yt-dlp_linux": "767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795",
    "yt-dlp_linux_aarch64": "e87e9533e89fe5889abaa21f5114dfe7756d6aa6219b83551add04d48b18e483",
    "yt-dlp_macos": "0f922c15ccc0b83eefa1c8bc9104e434318c4bf16e408e1ee93b7745a6efe0aa",
    "yt-dlp.exe": "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d",
}


def get_ytdlp_download_url() -> str:
    """Get the direct download URL for the yt-dlp standalone binary for this platform."""
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system.startswith("linux"):
        if "aarch64" in machine or "arm64" in machine:
            asset = "yt-dlp_linux_aarch64"
        else:
            asset = "yt-dlp_linux"
    elif system.startswith("darwin"):
        asset = "yt-dlp_macos"
    elif system.startswith("windows"):
        asset = "yt-dlp.exe"
    else:
        raise RuntimeError(f"Unsupported platform: {system} {machine}")

    return f"https://github.com/yt-dlp/yt-dlp/releases/download/{YTDLP_VERSION}/{asset}"


def download_ytdlp(url: str, dest: Path) -> None:
    """Download yt-dlp binary from the URL and verify its pinned sha256."""
    print(f"Downloading yt-dlp from {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "quran-app-builder"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    expected = YTDLP_SHA256[url.rsplit("/", 1)[-1]]
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise RuntimeError(f"yt-dlp checksum mismatch: expected {expected}, got {actual}")
    with open(dest, "wb") as f:
        f.write(data)
    os.chmod(dest, 0o755)
    print(f"Downloaded to {dest} (sha256 ok)")


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
