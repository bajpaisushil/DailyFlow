#!/usr/bin/env bash
#
# Is DailyFlow.apk current with the code?
#
# Exists because "I assumed the APK was up to date" is an easy and expensive mistake: a stale
# APK looks and installs exactly like a fresh one, so nothing about it says the feature you
# are testing was never in it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APK="$ROOT/DailyFlow.apk"
STAMP="$ROOT/.apk-commit"

if [ ! -f "$APK" ]; then
  echo "STALE — no APK has been built yet."
  echo "  Run: ./scripts/build-apk.sh"
  exit 1
fi

HEAD_SHA="$(git rev-parse --short HEAD)"
BUILT_SHA="$(cat "$STAMP" 2>/dev/null || echo 'unknown')"

if [ "$HEAD_SHA" = "$BUILT_SHA" ]; then
  echo "CURRENT — built from $BUILT_SHA ($(du -h "$APK" | cut -f1))"
  exit 0
fi

BEHIND="$(git rev-list --count "${BUILT_SHA}..HEAD" 2>/dev/null || echo '?')"
echo "STALE — APK is from $BUILT_SHA, HEAD is $HEAD_SHA ($BEHIND commits behind)."
echo "  Run: ./scripts/build-apk.sh"
exit 1
