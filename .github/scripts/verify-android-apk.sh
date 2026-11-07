#!/usr/bin/env bash
set -euo pipefail

APK_ROOT="${ANDROID_APK_ROOT:-tauri-app/src-tauri/gen/android/app/build/outputs/apk}"
EXPECTED_CODE="${ANDROID_VERSION_CODE:?ANDROID_VERSION_CODE must be set}"
EXPECTED_NAME="${ANDROID_VERSION_NAME:?ANDROID_VERSION_NAME must be set}"
ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$ANDROID_SDK" ]; then
  echo "::error::ANDROID_HOME or ANDROID_SDK_ROOT must be set"
  exit 1
fi
BUILD_TOOLS="$(find "$ANDROID_SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"

for tool in aapt apksigner zipalign; do
  if [ ! -x "$BUILD_TOOLS/$tool" ]; then
    echo "::error::Android Build Tools missing $tool"
    exit 1
  fi
done

APK_COUNT=0
while IFS= read -r -d '' APK; do
  APK_COUNT=$((APK_COUNT + 1))
  BADGING="$("$BUILD_TOOLS/aapt" dump badging "$APK")"
  case "$BADGING" in
    *"name='com.goldstac.quran' versionCode='$EXPECTED_CODE' versionName='$EXPECTED_NAME'"*) ;;
    *)
      echo "::error::unexpected Android package metadata in $APK"
      printf '%s\n' "$BADGING" | head -n 2
      exit 1
      ;;
  esac
  "$BUILD_TOOLS/apksigner" verify "$APK"
  echo "APK signature verified"
  "$BUILD_TOOLS/zipalign" -c -P 16 -v 4 "$APK"
  python3 - "$APK" <<'PY'
import sys
import zipfile

path = sys.argv[1]
with zipfile.ZipFile(path) as apk:
    names = apk.namelist()
    info = apk.getinfo("resources.arsc")
    with open(path, "rb") as source:
        source.seek(info.header_offset)
        header = source.read(30)
    data_offset = info.header_offset + 30 + int.from_bytes(header[26:28], "little") + int.from_bytes(header[28:30], "little")
    if info.compress_type != zipfile.ZIP_STORED or data_offset % 4:
        raise SystemExit("resources.arsc must be stored and 4-byte aligned")
    abis = {name.split("/")[1] for name in names if name.startswith("lib/") and name.count("/") >= 2}
    required = {"arm64-v8a", "armeabi-v7a", "x86", "x86_64"}
    if not required.issubset(abis):
        raise SystemExit(f"universal APK missing ABIs: {', '.join(sorted(required - abis))}")
    for name in names:
        if name.startswith("lib/") and name.endswith(".so"):
            lib = apk.getinfo(name)
            with open(path, "rb") as source:
                source.seek(lib.header_offset)
                header = source.read(30)
            offset = lib.header_offset + 30 + int.from_bytes(header[26:28], "little") + int.from_bytes(header[28:30], "little")
            if lib.compress_type != zipfile.ZIP_STORED or offset % 16384:
                raise SystemExit(f"native library is not stored and 16 KB aligned: {name}")
print(f"verified APK layout: {path}")
PY
  echo "verified APK: $APK"
done < <(find "$APK_ROOT" -type f -name '*.apk' -print0)

if [ "$APK_COUNT" -eq 0 ]; then
  echo "::error::Android build produced no APK files"
  exit 1
fi
