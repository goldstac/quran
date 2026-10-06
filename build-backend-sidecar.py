#!/usr/bin/env python3
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP_PATH = ROOT / "web" / "app.py"
TEMPLATES_DIR = ROOT / "web" / "templates"
STATIC_DIR = ROOT / "web" / "static"


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


def pyinstaller_args() -> list[str]:
    args = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onefile",
        "--clean",
        "--name",
        f"quran-backend-{rust_target_triple()}",
        "--distpath",
        str(ROOT / "dist"),
        "--workpath",
        str(ROOT / ".pyinstaller-build"),
        "--specpath",
        str(ROOT / ".pyinstaller-build"),
        "--collect-all",
        "flask",
        "--collect-all",
        "flask_cors",
        "--add-data",
        f"{TEMPLATES_DIR}{os.pathsep}templates",
        "--add-data",
        f"{STATIC_DIR}{os.pathsep}static",
        str(APP_PATH),
    ]

    if platform.system().lower().startswith("windows"):
        args.insert(7, "--windowed")

    return args


if __name__ == "__main__":
    if not APP_PATH.exists():
        raise SystemExit(f"Missing backend entrypoint: {APP_PATH}")
    if not TEMPLATES_DIR.exists() or not STATIC_DIR.exists():
        raise SystemExit("Missing web/templates or web/static directories")

    cmd = pyinstaller_args()
    print("Running:", " ".join(cmd))
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError as exc:
        raise SystemExit("PyInstaller is not installed. Install it with: pip install pyinstaller") from exc

    name = f"quran-backend-{rust_target_triple()}"
    sidecar = ROOT / "dist" / name

    if sidecar.is_dir():
        raise SystemExit(
            f"{sidecar} is a directory. Tauri sidecars must be one executable, "
            "so build with --onefile."
        )
    if not sidecar.is_file():
        raise SystemExit(f"PyInstaller completed, but expected output was not found: {sidecar}")

    print(f"Built backend sidecar at: {sidecar}")
