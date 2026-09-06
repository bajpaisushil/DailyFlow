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

echo
echo "Done: $OUT  ($(du -h "$OUT" | cut -f1))"
echo "Send that file to anyone. They may need to allow installing from unknown sources."
