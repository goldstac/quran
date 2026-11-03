#!/usr/bin/env bash
set -uo pipefail

fail() { echo "::error::$1"; exit 1; }

TAG="${NOTES_TAG:-${GITHUB_REF_NAME:-}}"
REF="${NOTES_REF:-$TAG}"
[ -n "$TAG" ] || fail "no version given for the release notes"
[ -n "$REF" ] || fail "no git ref given for the release notes"

PREV="${NOTES_PREV:-}"
if [ -z "$PREV" ]; then
  PREV=$(git describe --tags --abbrev=0 --match 'v*' "${REF}^" 2>/dev/null || true)
fi
if [ -n "$PREV" ]; then RANGE="$PREV..$REF"; else RANGE="$REF"; fi

OUT="${1:-release-notes.md}"
TMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

ALL=$(git log --no-merges --max-count=150 --pretty=format:'- %s' "$RANGE" | head -c 8000)
CHANGES=$(printf '%s\n' "$ALL" | grep -E '^- (feat|fix|perf|revert)' || true)
if [ -z "$CHANGES" ]; then CHANGES="$ALL"; fi
if [ -z "$CHANGES" ]; then CHANGES="- nothing user facing in this one"; fi

SYS=$(cat <<'EOF'
You write the top of the release description for Quran, an open source Islamic app: a Quran reader with recitations, translations and reading, plus a nasheeds player that searches YouTube, streams audio through a local proxy, keeps a library with favorites and playlists, downloads nasheeds for offline listening, imports local files, and offers Discord presence and bot sync. It ships as a desktop app for Linux, macOS and Windows and as an Android APK.
You get the version and the list of changes since the previous release. Write exactly two parts and nothing else:
1. A TL;DR: one or two plain sentences, no heading in front of them, in user language, saying what this release is mostly about.
2. Then a "## What's new" heading with 3 to 6 short bullets of the changes users will care about.
Both sections after yours are appended by the pipeline: a "## Changes" section holding the verbatim commit list, and a "## Downloads" section with the installer lines. Never write those two headings yourself, never repeat the Downloads lines, never link anywhere.
Rules:
- Say nasheeds and never songs.
- Never use an em dash. Use commas, periods, semicolons or " - " instead.
- Plain, casual, short. No marketing or legal fluff.
- Only describe what is in the change list, never invent features.
- Translate commit types into user language: chore, ci, build, style and docs commits can be dropped unless they matter to users.
- If the version contains a hyphen, for example v1.2.1-pre-alpha.3, say in the TL;DR that it is a pre-release.
- Under 160 words in total. Headings and bullets only, no code blocks, no quotes around the whole text.
EOF
)

USR=$(cat <<EOF
Version: $TAG
Previous release: ${PREV:-none, this is the first release}
Changes since then:
$CHANGES
EOF
)

NOTES=""
if [ -n "${GROQ_API_KEY:-}" ]; then
  MODEL="${GROQ_MODEL:-llama-3.3-70b-versatile}"
  REQ=$(jq -n --arg model "$MODEL" --arg sys "$SYS" --arg usr "$USR" \
    '{model: $model, messages: [{role: "system", content: $sys}, {role: "user", content: $usr}], temperature: 0.5, max_tokens: 700}')
  CODE=$(curl -sS -m 60 -o "$TMP/groq.json" -w '%{http_code}' \
    -X POST https://api.groq.com/openai/v1/chat/completions \
    -H "Authorization: Bearer $GROQ_API_KEY" -H 'Content-Type: application/json' \
    -d "$REQ" || echo 000)
  if [ "$CODE" = "200" ]; then
    NOTES=$(jq -r '.choices[0].message.content // empty' "$TMP/groq.json" 2>/dev/null || true)
  else
    echo "::warning::groq answered $CODE, falling back to the plain change list"
    head -c 500 "$TMP/groq.json" 2>/dev/null
    echo
  fi
else
  echo "::notice::GROQ_API_KEY is not set, falling back to the plain change list"
fi

if [ -n "$NOTES" ]; then
  NOTES=$(printf '%s' "$NOTES" | sed -e '1{/^```/d}' -e '${/^```/d}')
  NOTES=$(printf '%s' "$NOTES" | sed -e '1s/^"//' -e '$s/"$//' -e 's/—/-/g' -e 's/–/-/g')
  NOTES=$(printf '%s\n' "$NOTES" | awk '/^##[ \t]+(Changes|Downloads)/{exit} {print}')
  NOTES=$(printf '%s' "$NOTES" | sed -e '/./,$!d')
  if ! printf '%s' "$NOTES" | grep -q '[^[:space:]]'; then NOTES=""; fi
fi

{
  if [ -n "$NOTES" ]; then
    printf '%s\n\n' "$NOTES"
  fi
  printf '## Changes\n\n%s\n\n' "$CHANGES"
  printf '## Downloads\n\n- Linux: AppImage and Debian package\n- macOS: DMG\n- Windows: EXE\n- Android: APK (arm64 + armeabi-v7a + x86 + x86_64 universal, signed)\n'
} > "$OUT"
echo "release notes:"
cat "$OUT"
