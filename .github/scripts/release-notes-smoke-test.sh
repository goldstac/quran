#!/usr/bin/env bash
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
TMP="${RUNNER_TEMP:-/tmp}"
AI="$TMP/release-notes-ai.md"
FB="$TMP/release-notes-fallback.md"

problems=0
ok() { echo "ok: $1"; }
problem() { echo "::error::$1"; problems=$((problems + 1)); }
fail() { echo "::error::$1"; exit 1; }

echo "== groq =="
[ -n "${GROQ_API_KEY:-}" ] || fail "GROQ_API_KEY is not set, this run cannot prove the groq path"
echo "model: ${GROQ_MODEL:-llama-3.3-70b-versatile}"

echo
echo "== 1. notes with groq =="
bash "$HERE/write-release-notes.sh" "$AI" || fail "write-release-notes.sh failed with the key set"

echo
echo "== 2. notes without groq (the fallback) =="
GROQ_API_KEY= bash "$HERE/write-release-notes.sh" "$FB" || fail "write-release-notes.sh failed without the key"

echo
echo "================ notes with groq ================"
cat "$AI"
echo
echo "================ fallback notes ================"
cat "$FB"
echo

check_structure() {
  local f="$1"
  local label="$2"
  [ -s "$f" ] || { problem "$label: no notes were written"; return; }
  [ "$(grep -c '^## Changes$' "$f")" = "1" ] || problem "$label: expected exactly one '## Changes' heading"
  [ "$(grep -c '^## Downloads$' "$f")" = "1" ] || problem "$label: expected exactly one '## Downloads' heading"
  grep -q '^- Linux: AppImage and Debian package$' "$f" || problem "$label: missing the Linux download line"
  grep -q '^- macOS: DMG$' "$f" || problem "$label: missing the macOS download line"
  grep -q '^- Windows: EXE$' "$f" || problem "$label: missing the Windows download line"
  grep -q '^- Android: APK (arm64 + armeabi-v7a + x86 + x86_64 universal, signed)$' "$f" || problem "$label: missing the Android download line"
  if grep -qE '[‐‑‒–—―−]' "$f"; then problem "$label: contains a dash that is not an ascii hyphen"; fi
}

check_structure "$AI" "groq notes"
check_structure "$FB" "fallback notes"

echo "== what groq contributed =="
AI_TOP=$(awk '/^## Changes$/{exit} {print}' "$AI")
if [ -z "$(printf '%s' "$AI_TOP" | tr -d '[:space:]')" ]; then
  problem "groq notes: nothing above '## Changes', groq did not contribute"
else
  FIRST=$(printf '%s\n' "$AI_TOP" | sed -e '/./,$!d' | head -1)
  case "$FIRST" in
    \#*) problem "groq notes: the description must open with the tl;dr, not a heading" ;;
    '') problem "groq notes: the description is empty" ;;
    *) ok "opens with: $FIRST" ;;
  esac
  printf '%s' "$AI_TOP" | grep -q "## What's new" || problem "groq notes: missing the \"## What's new\" heading"
  if printf '%s' "$AI_TOP" | grep -qiE '\bsongs?\b'; then problem "groq notes: says songs instead of nasheeds"; fi
  BULLETS=$(printf '%s' "$AI_TOP" | grep -c '^- ')
  if [ "$BULLETS" -lt 3 ] || [ "$BULLETS" -gt 6 ]; then
    problem "groq notes: expected 3 to 6 bullets under What's new, got $BULLETS"
  else
    ok "$BULLETS bullets under What's new"
  fi
  WORDS=$(printf '%s' "$AI_TOP" | wc -w)
  if [ "$WORDS" -gt 160 ]; then problem "groq notes: $WORDS words, the cap is 160"; else ok "$WORDS words"; fi
  if printf '%s' "$AI_TOP" | grep -qiE '(updates card|in-app card).{0,80}(shows?|displays?|includes?).{0,80}(release description|release notes)|(release description|release notes).{0,80}(updates card|in-app card).{0,80}(shows?|displays?|includes?)'; then
    problem "groq notes: claims release descriptions appear in the Updates card"
  else
    ok "does not claim release descriptions appear in the Updates card"
  fi
fi

echo "== what the fallback contributed =="
FB_TOP=$(awk '/^## Changes$/{exit} {print}' "$FB")
if [ -n "$(printf '%s' "$FB_TOP" | tr -d '[:space:]')" ]; then
  problem "fallback notes: expected nothing above '## Changes' without a key"
else
  ok "starts at ## Changes, as designed"
fi

echo "== the sections the pipeline writes =="
awk '/^## Changes$/{p=1} p' "$AI" > "$TMP/notes-ai.tail"
awk '/^## Changes$/{p=1} p' "$FB" > "$TMP/notes-fallback.tail"
if diff -u "$TMP/notes-fallback.tail" "$TMP/notes-ai.tail" > "$TMP/notes-tail.diff"; then
  ok "identical Changes and Downloads sections in both runs"
else
  problem "the Changes and Downloads sections differ between the two runs"
  head -30 "$TMP/notes-tail.diff"
fi

echo
if [ "$problems" = "0" ]; then
  echo "release notes smoke test passed"
else
  echo "::error::release notes smoke test failed with $problems problem(s)"
  exit 1
fi
