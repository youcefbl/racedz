#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NATIVE_ROOT="$REPO_ROOT/native-android"
TEST_ITERATIONS="${ZIDRUN_BENCHMARK_ITERATIONS:-5}"
DEV_SERVER_PID=""
DEV_SERVER_LOG=""

if [[ -n "${ADB:-}" ]]; then
  ADB_BIN="$ADB"
elif [[ -x "${HOME}/zidrun-toolchain/android-sdk/platform-tools/adb" ]]; then
  ADB_BIN="${HOME}/zidrun-toolchain/android-sdk/platform-tools/adb"
else
  ADB_BIN="$(command -v adb || true)"
fi

if [[ -z "$ADB_BIN" || ! -x "$ADB_BIN" ]]; then
  echo "adb was not found. Set ADB or add Android platform-tools to PATH." >&2
  exit 1
fi

if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
  TEST_JAVA_HOME="$JAVA_HOME"
elif [[ -x "${HOME}/zidrun-toolchain/jdk17/bin/java" ]]; then
  TEST_JAVA_HOME="${HOME}/zidrun-toolchain/jdk17"
else
  echo "JDK 17 was not found. Set JAVA_HOME before running device tests." >&2
  exit 1
fi

if [[ -z "${ANDROID_SERIAL:-}" ]]; then
  mapfile -t CONNECTED_SERIALS < <("$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  if [[ ${#CONNECTED_SERIALS[@]} -ne 1 ]]; then
    echo "Expected one adb device, found ${#CONNECTED_SERIALS[@]}. Set ANDROID_SERIAL to the Wi-Fi device shown by 'adb devices'." >&2
    exit 1
  fi
  export ANDROID_SERIAL="${CONNECTED_SERIALS[0]}"
fi

adb_device() {
  "$ADB_BIN" -s "$ANDROID_SERIAL" "$@"
}

cleanup() {
  adb_device shell settings put system font_scale 1.0 >/dev/null 2>&1 || true
  adb_device shell settings put global animator_duration_scale 1 >/dev/null 2>&1 || true
  adb_device shell cmd locale set-app-locales dz.racedz.nativeapp.debug --locales en >/dev/null 2>&1 || true
  adb_device shell cmd locale set-app-locales dz.racedz.nativeapp.benchmark --locales en >/dev/null 2>&1 || true
  if [[ -n "$DEV_SERVER_PID" ]]; then
    kill "$DEV_SERVER_PID" >/dev/null 2>&1 || true
    wait "$DEV_SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$DEV_SERVER_LOG" && -f "$DEV_SERVER_LOG" ]]; then
    rm -f "$DEV_SERVER_LOG"
  fi
}
trap cleanup EXIT

MODEL="$(adb_device shell getprop ro.product.model | tr -d '\r')"
ANDROID_VERSION="$(adb_device shell getprop ro.build.version.release | tr -d '\r')"
IS_EMULATOR="$(adb_device shell getprop ro.kernel.qemu | tr -d '\r')"
if [[ "$IS_EMULATOR" == "1" || "$ANDROID_SERIAL" == emulator-* ]]; then
  echo "Macrobenchmark must run on a physical phone, not $ANDROID_SERIAL." >&2
  exit 1
fi

echo "Device: $MODEL · Android $ANDROID_VERSION · $ANDROID_SERIAL"

if ! curl --silent --fail --max-time 2 http://127.0.0.1:3003/api/v1/config >/dev/null; then
  docker start racedz_postgres_dev >/dev/null
  DEV_SERVER_LOG="$(mktemp -t zidrun-native-device-server.XXXXXX.log)"
  (
    cd "$REPO_ROOT"
    npm run dev
  ) >"$DEV_SERVER_LOG" 2>&1 &
  DEV_SERVER_PID="$!"

  for _ in $(seq 1 60); do
    if curl --silent --fail --max-time 2 http://127.0.0.1:3003/api/v1/config >/dev/null; then
      break
    fi
    if ! kill -0 "$DEV_SERVER_PID" >/dev/null 2>&1; then
      echo "The local dev server stopped before becoming ready:" >&2
      tail -80 "$DEV_SERVER_LOG" >&2
      exit 1
    fi
    sleep 1
  done
fi

if ! curl --silent --fail --max-time 2 http://127.0.0.1:3003/api/v1/config >/dev/null; then
  echo "The local API did not become ready at http://127.0.0.1:3003." >&2
  exit 1
fi

adb_device reverse tcp:3003 tcp:3003 >/dev/null

# Tests own these local-only packages. Starting clean keeps auth/onboarding deterministic while the
# normal internal/release apps and their data remain untouched.
adb_device shell pm clear dz.racedz.nativeapp.debug >/dev/null 2>&1 || true
adb_device shell pm clear dz.racedz.nativeapp.benchmark >/dev/null 2>&1 || true

echo "Running black-box UI regression on the physical phone…"
(
  cd "$NATIVE_ROOT"
  JAVA_HOME="$TEST_JAVA_HOME" ./gradlew :app:connectedDebugAndroidTest \
    -Pzidrun.debugApiBase=http://localhost:3003/
)

echo "Collecting non-debuggable Macrobenchmark startup/frame metrics…"
(
  cd "$NATIVE_ROOT"
  JAVA_HOME="$TEST_JAVA_HOME" ./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
    -Pzidrun.debugApiBase=http://localhost:3003/ \
    -Pandroid.testInstrumentationRunnerArguments.zidrunIterations="$TEST_ITERATIONS"
)

echo "Native device regression passed."
echo "UI report: $NATIVE_ROOT/app/build/reports/androidTests/connected/"
echo "Benchmark JSON/traces: $NATIVE_ROOT/macrobenchmark/build/outputs/connected_android_test_additional_output/"
