#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <path-to-appimage>" >&2
  exit 2
fi

APPIMAGE="$(realpath "$1")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$APPIMAGE" "$WORK/original.AppImage"
chmod +x "$WORK/original.AppImage"
(
  cd "$WORK"
  ./original.AppImage --appimage-extract >/dev/null
)

APPDIR="$WORK/squashfs-root"
LIBDIR="$APPDIR/usr/lib"

if ! compgen -G "$LIBDIR/libwayland-client.so*" >/dev/null; then
  echo "error: libwayland-client not found in $LIBDIR - bundler layout changed, update fix-appimage.sh" >&2
  exit 1
fi

echo "removing bundled libwayland libs (they break EGL on Mesa 25+ hosts)"
rm -f "$LIBDIR"/libwayland-*.so*

echo "removing bundled gstreamer, glib and platform libs (the AppImage uses the host media stack)"
rm -f "$LIBDIR"/libgst*.so*
rm -f "$LIBDIR"/libglib-2.0.so* "$LIBDIR"/libgobject-2.0.so* "$LIBDIR"/libgio-2.0.so* "$LIBDIR"/libgmodule-2.0.so* "$LIBDIR"/libgthread-2.0.so*
rm -f "$LIBDIR"/libmount.so* "$LIBDIR"/libblkid.so* "$LIBDIR"/libsystemd.so* "$LIBDIR"/libudev.so*
rm -f "$LIBDIR"/libpcre2-8.so* "$LIBDIR"/libnghttp2.so*

for lib in libwayland-client.so.0 libgstreamer-1.0.so.0 libglib-2.0.so.0; do
  if [ -e "$LIBDIR/$lib" ]; then
    echo "error: failed to remove bundled $lib" >&2
    exit 1
  fi
done

echo "neutralizing AppRun GST overrides so the host gstreamer is used"
WRAPPED="$APPDIR/AppRun.wrapped"
if ! grep -q "GST_PLUGIN_SYSTEM_PATH" "$WRAPPED"; then
  echo "error: GST_PLUGIN_SYSTEM_PATH override not found in AppRun.wrapped - update fix-appimage.sh" >&2
  exit 1
fi
perl -pi -e 's/GST_PLUGIN_SYSTEM_PATH/XST_PLUGIN_SYSTEM_PATH/g' "$WRAPPED"

ARCH="$(uname -m)"
TOOL="$WORK/appimagetool.AppImage"
curl -fsSL -o "$TOOL" "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-$ARCH.AppImage"
chmod +x "$TOOL"

OUT="$WORK/fixed.AppImage"
(
  cd "$WORK"
  APPIMAGE_EXTRACT_AND_RUN=1 "$TOOL" "$APPDIR" "$OUT" >/dev/null
)
chmod +x "$OUT"
mv -f "$OUT" "$APPIMAGE"
echo "fixed $APPIMAGE"
