#!/usr/bin/env bash
# Tests for scripts/android-version-from-tag.sh — the Play versionCode scheme.
#
#   bash scripts/test-android-version-from-tag.sh
#
# Run by .github/workflows/android-play-internal.yml before it derives a version, so a regression in
# the parser fails the release instead of publishing a code Play will reject later.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
parse="$here/android-version-from-tag.sh"
passed=0
failed=0

ok() {
  local label="$1" expected="$2" actual
  if actual="$(bash "$parse" "$label" 2>/dev/null)" && [[ "$actual" == "$expected" ]]; then
    passed=$((passed + 1))
  else
    echo "FAIL  '$label': expected '$expected', got '${actual:-<rejected>}'"
    failed=$((failed + 1))
  fi
}

rejected() {
  local label="$1" why="$2"
  if bash "$parse" "$label" >/dev/null 2>&1; then
    echo "FAIL  '$label' should be rejected ($why)"
    failed=$((failed + 1))
  else
    passed=$((passed + 1))
  fi
}

# Release candidates and finals.
ok "v0.8.6-rc1" "0.8.6 80601"
ok "v0.8.6-rc98" "0.8.6 80698"
ok "v0.8.6" "0.8.6 80699"
ok "v1.2.3-rc12" "1.2.3 1020312"
ok "v0.8.2-rc1" "0.8.2 80201"
# Manual-dispatch input form (no leading v).
ok "0.8.6-rc2" "0.8.6 80602"
ok "0.8.6" "0.8.6 80699"
# Boundary components and leading zeros.
ok "v0.99.99-rc98" "0.99.99 999998"
ok "v0.99.99" "0.99.99 999999"
ok "v1.0.0-rc1" "1.0.0 1000001"
ok "v0.08.06-rc01" "0.8.6 80601"
ok "v2099.99.99" "2099.99.99 2099999999"

# The review finding: RC99 would collide with the final release's code.
rejected "v0.8.6-rc99" "rc99 equals the final's versionCode"
rejected "v0.8.6-rc0" "rc numbers start at 1"
rejected "v0.8.6-rc100" "rc out of range"
rejected "v0.100.0" "minor overflows into major"
rejected "v0.8.100" "patch overflows into minor"
rejected "v2100.0.0" "above Play's versionCode ceiling"
rejected "v0.0.0" "not releasable"
# Malformed.
rejected "" "empty"
rejected "v0.8" "missing patch"
rejected "v0.8.6.1" "four components"
rejected "android-v1.0.0" "old prefix"
rejected "v0.8.6-beta1" "unknown suffix"
rejected "v0.8.6-rc" "rc without a number"
rejected "v0.8.6rc1" "missing dash"
rejected "vv0.8.6" "double v"
rejected "v0.8.6 " "trailing space"
rejected "v-1.0.0" "negative"

# Codes must strictly increase in release order — the property Play enforces.
prev=0
for label in v0.8.6-rc1 v0.8.6-rc2 v0.8.6-rc98 v0.8.6 v0.8.7-rc1 v0.8.7 v0.9.0-rc1 v1.0.0-rc1 v1.0.0; do
  code="$(bash "$parse" "$label" | cut -d' ' -f2)"
  if (( code <= prev )); then
    echo "FAIL  ordering: $label ($code) does not exceed the previous code ($prev)"
    failed=$((failed + 1))
  else
    passed=$((passed + 1))
  fi
  prev=$code
done

echo "$passed passed, $failed failed"
(( failed == 0 ))
