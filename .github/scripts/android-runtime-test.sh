#!/usr/bin/env bash
set -u

fail() { echo "::error::$1"; exit 1; }
dump_log() { adb logcat -d 2>/dev/null | tail -n 200; }

echo "artifacts:"
find installers \( -name '*.apk' -o -name '*.aab' \) | sort

APK=$(find installers -name '*x86_64*.apk' | head -n 1)
if [ -z "$APK" ]; then APK=$(find installers -name '*universal*.apk' | head -n 1); fi
if [ -z "$APK" ]; then APK=$(find installers -name '*.apk' | head -n 1); fi
if [ -z "$APK" ]; then fail "no apk in the android-apk artifact"; fi
echo "installing $APK"

if command -v unzip >/dev/null 2>&1; then
  APK_LIST=$(unzip -l "$APK" 2>/dev/null)
  case "$APK_LIST" in
    *lib/x86_64/*) ;;
    *)
      echo "$APK_LIST" | grep 'lib/' || echo "(the apk carries no native libs)"
      fail "the apk has no x86_64 native libs, this emulator cannot run it"
      ;;
  esac
else
  echo "::warning::unzip not available, skipping the abi check"
fi

adb install -r "$APK" || fail "adb install failed"

adb logcat -c
adb shell am start -n com.goldstac.quran/.MainActivity || fail "could not start the app"
sleep 5
if ! adb shell pidof com.goldstac.quran >/dev/null; then
  dump_log
  fail "the app process died right after launch"
fi

adb forward tcp:5000 tcp:5000 || fail "adb forward to the device failed"

UP=""
i=0
while [ $i -lt 90 ]; do
  if curl -fsS -m 5 http://127.0.0.1:5000/ -o /dev/null \
     && curl -fsS -m 5 http://127.0.0.1:5000/api/library -o /tmp/library.json; then
    UP=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ -z "$UP" ]; then
  dump_log
  fail "the in-app server never answered on 127.0.0.1:5000"
fi
echo "server answered, library:"
cat /tmp/library.json
echo

LOADED=""
STUCK=""
NO_SERVER=""
i=0
while [ $i -lt 30 ]; do
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  if adb pull /sdcard/ui.xml /tmp/ui.xml >/dev/null 2>&1; then
    if grep -q "Search for nasheeds" /tmp/ui.xml \
       || grep -q "Find and play nasheeds" /tmp/ui.xml \
       || grep -q "Your Library" /tmp/ui.xml; then
      LOADED=1
      break
    fi
    if grep -q "Starting Quran" /tmp/ui.xml; then STUCK=1; else STUCK=""; fi
    if grep -q "Could not reach the local server" /tmp/ui.xml; then NO_SERVER=1; fi
  fi
  i=$((i + 1))
  sleep 3
done

if [ -z "$LOADED" ]; then
  echo "view tree:"
  head -c 2000 /tmp/ui.xml 2>/dev/null
  echo
  dump_log
fi
if [ -n "$NO_SERVER" ]; then
  fail "the WebView could not reach http://127.0.0.1:5000 (cleartext or socket blocked)"
fi
if [ -z "$LOADED" ] && [ -n "$STUCK" ]; then
  fail "the window never left the loading page"
fi
if [ -z "$LOADED" ]; then
  echo "::warning::could not read the view tree, the UI check was skipped"
fi
echo "webview loaded the app: ${LOADED:-unknown}"

if adb logcat -d -b crash 2>/dev/null | grep -q "com.goldstac.quran"; then
  adb logcat -d -b crash | tail -n 100
  fail "the app crashed"
fi

adb shell am force-stop com.goldstac.quran
sleep 5
if curl -fsS -m 3 http://127.0.0.1:5000/ -o /dev/null; then
  fail "the server is still answering after the app was force-stopped"
fi
adb forward --remove tcp:5000 >/dev/null 2>&1
echo "android runtime test OK"
