import json
import os
import re
import sys
from pathlib import Path


VERSION_PATTERN = re.compile(
    r"^(\d+)\.(\d+)\.(\d+)(?:-(?:pre-)?(alpha|beta|rc)\.(\d+))?$"
)
STAGE_OFFSETS = {"alpha": 0, "beta": 3000, "rc": 6000}


def version_code(version):
    match = VERSION_PATTERN.fullmatch(version)
    if not match:
        raise ValueError(f"unsupported Android version: {version}")
    major, minor, patch, stage, stage_number = match.groups()
    major, minor, patch = int(major), int(minor), int(patch)
    if major > 20 or minor > 99 or patch > 99:
        raise ValueError(f"version is outside the Android versionCode range: {version}")
    if stage is None:
        stage_value = 9999
    else:
        stage_number = int(stage_number)
        if not 1 <= stage_number <= 2999:
            raise ValueError(f"pre-release number is outside the supported range: {version}")
        stage_value = STAGE_OFFSETS[stage] + stage_number
    result = major * 100_000_000 + minor * 1_000_000 + patch * 10_000 + stage_value
    if result > 2_100_000_000:
        raise ValueError(f"versionCode exceeds Android's limit: {version}")
    return result


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else json.loads(Path("package.json").read_text())["version"]
    code = version_code(version)
    if len(sys.argv) > 2 and sys.argv[2] == "--dry-run":
        print(f"{version} {code}")
        return
    if len(sys.argv) > 2:
        raise ValueError("usage: stamp-android-version.py [version] [--dry-run]")
    android_properties = Path("tauri-app/src-tauri/gen/android/app/tauri.properties")
    android_properties.write_text(
        f"tauri.android.versionName={version}\n"
        f"tauri.android.versionCode={code - 1}\n"
    )
    with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as env:
        env.write(f"ANDROID_VERSION_NAME={version}\n")
        env.write(f"ANDROID_VERSION_CODE={code}\n")
    print(f"Android version {version}, versionCode {code}")


if __name__ == "__main__":
    main()
