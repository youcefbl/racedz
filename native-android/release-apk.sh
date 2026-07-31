#!/usr/bin/env bash
#
# Build a testable native APK and copy it to ~/Downloads named after the version inside it.
#
# The filename is read back OUT of the built APK rather than typed in, so it can never disagree
# with the manifest — which is exactly what went wrong before this script existed (two different
# builds shipped as "v0.2" and "v0.3" while both declared 0.2.0 internally).
#
# Refuses to overwrite an existing file: a tester who already has v0.4 installed and is handed a
# different v0.4 has no way to tell them apart, and Android will not reinstall over the same
# versionCode anyway. Bump versionCode AND versionName in app/build.gradle.kts first.
#
#   ./release-apk.sh              # production build (https://zidrun.com)
#   ./release-apk.sh debug        # emulator build (10.0.2.2, cleartext allowed)
#
set -euo pipefail

cd "$(dirname "$0")"

VARIANT="${1:-internal}"
case "$VARIANT" in
  internal) GRADLE_TASK="assembleInternal"; APK_PATH="app/build/outputs/apk/internal/app-internal.apk" ;;
  debug)    GRADLE_TASK="assembleDebug";    APK_PATH="app/build/outputs/apk/debug/app-debug.apk" ;;
  *) echo "Unknown variant '$VARIANT' (expected: internal, debug)" >&2; exit 2 ;;
esac

AAPT2="$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/* | sort -V | tail -1)/aapt2"
[ -x "$AAPT2" ] || { echo "aapt2 not found under the Android SDK build-tools" >&2; exit 1; }

echo "Building $VARIANT…"
./gradlew "$GRADLE_TASK" --console=plain -q

BADGING="$("$AAPT2" dump badging "$APK_PATH")"
VERSION_NAME="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$BADGING")"
VERSION_CODE="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$BADGING")"
PACKAGE="$(sed -n "s/.*package: name='\([^']*\)'.*/\1/p" <<<"$BADGING")"

# The build type already appends "-internal"/"-debug" to versionName; the filename says the variant
# too, so strip it rather than shipping "…-internal-v0.4.0-internal.apk".
VERSION_LABEL="${VERSION_NAME%-$VARIANT}"

DEST="$HOME/Downloads/zidrun-native-${VARIANT}-v${VERSION_LABEL}.apk"
if [ -e "$DEST" ]; then
  echo "Refusing to overwrite $DEST" >&2
  echo "Bump versionCode and versionName in app/build.gradle.kts, then run this again." >&2
  exit 1
fi

cp "$APK_PATH" "$DEST"

echo
echo "  file        $DEST"
echo "  package     $PACKAGE"
echo "  version     $VERSION_NAME (versionCode $VERSION_CODE)"
[ "$VARIANT" = "internal" ] && echo "  api         https://zidrun.com — debug-signed, internal testing only"
[ "$VARIANT" = "debug" ]    && echo "  api         http://10.0.2.2:3003 — emulator only"
