#!/usr/bin/env bash
#
# Build a signed, shareable DailyFlow APK.
#
# Everything happens on this machine — no Expo account, no cloud build, nothing uploaded.
# The APK it produces can be sent to anyone and installed directly.
#
#   ./scripts/build-apk.sh
#
# Optional, to use your own signing key instead of the project's:
#   DAILYFLOW_KEYSTORE_PASSWORD=... DAILYFLOW_KEY_PASSWORD=... ./scripts/build-apk.sh
#
# Optional, to enable the map on Android (iOS needs no key):
#   GOOGLE_MAPS_API_KEY=... ./scripts/build-apk.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if [ ! -d "$ANDROID_HOME" ]; then
  echo "Android SDK not found at $ANDROID_HOME."
  echo "Install Android Studio, or set ANDROID_HOME to your SDK."
  exit 1
fi

KEYSTORE="$ROOT/android/app/dailyflow-release.keystore"

# Captured before anything is built. Stamping at the END would record whatever HEAD had
# become by then, which after a four-minute build may be a commit whose code is not in this
# APK at all — exactly the false confidence the stamp exists to prevent.
BUILT_FROM="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
if ! git -C "$ROOT" diff --quiet 2>/dev/null || ! git -C "$ROOT" diff --cached --quiet 2>/dev/null; then
  BUILT_FROM="${BUILT_FROM}+edits"
  echo "Note: there are uncommitted changes; they ARE in this build."
fi

echo "==> Generating the native project"
npx expo prebuild --platform android

# The keystore lives outside the generated project so a prebuild cannot delete it. An update
# can only replace an installed app if it is signed with the SAME key, so this file matters:
# keep it, and keep it out of version control.
if [ -f "$ROOT/dailyflow-release.keystore" ]; then
  echo "==> Reusing the existing signing key"
  cp "$ROOT/dailyflow-release.keystore" "$KEYSTORE"
elif [ ! -f "$KEYSTORE" ]; then
  echo "==> Creating a signing key"
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore "$KEYSTORE" -alias "${DAILYFLOW_KEY_ALIAS:-dailyflow}" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "${DAILYFLOW_KEYSTORE_PASSWORD:-dailyflow}" \
    -keypass "${DAILYFLOW_KEY_PASSWORD:-dailyflow}" \
    -dname "CN=DailyFlow, OU=Personal, O=DailyFlow, C=IN"
  cp "$KEYSTORE" "$ROOT/dailyflow-release.keystore"
  echo "    Saved a copy at dailyflow-release.keystore — keep it to ship updates."
fi

echo "==> Building"
cd android
./gradlew assembleRelease --no-daemon

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
OUT="$ROOT/DailyFlow.apk"
cp "$APK" "$OUT"

# A stale APK is indistinguishable from a fresh one by looking at it, so the only reliable
# check is recording what actually went into it.
printf '%s' "$BUILT_FROM" > "$ROOT/.apk-commit"

echo
echo "Done: $OUT  ($(du -h "$OUT" | cut -f1))  from $BUILT_FROM"
echo "Send that file to anyone. They may need to allow installing from unknown sources."
