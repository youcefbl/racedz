#!/usr/bin/env bash
# Derive the Android versionName / versionCode for a Play release from a version label.
#
#   scripts/android-version-from-tag.sh v0.8.6-rc2   ->  0.8.6 80602
#   scripts/android-version-from-tag.sh 0.8.6        ->  0.8.6 80699
#
# Accepts `vX.Y.Z`, `vX.Y.Z-rcN` (the release tags this repo pushes) and the same without the `v`
# (the manual-dispatch input). Prints "<versionName> <versionCode>" and exits 0, or prints why on
# stderr and exits 1.
#
# Scheme: versionCode = X*1000000 + Y*10000 + Z*100 + N, where N is the RC number (1..98) and a
# final release uses N = 99, so a final always outranks every one of its own candidates and the next
# patch's RC1 outranks the previous final. RC 99 is rejected rather than accepted: it would produce
# the same code as the final release, and Play refuses a duplicate versionCode — the final could
# then never be published. Y and Z stay <= 99 so they cannot overflow into the next field.
#
# Tested by scripts/test-android-version-from-tag.sh (run in the Play workflow before any build).
set -euo pipefail

label="${1:-}"
if [[ ! "$label" =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+)(-rc([0-9]+))?$ ]]; then
  echo "'$label' is not X.Y.Z or X.Y.Z-rcN (an optional leading v is allowed)" >&2
  exit 1
fi

major=$((10#${BASH_REMATCH[1]}))
minor=$((10#${BASH_REMATCH[2]}))
patch=$((10#${BASH_REMATCH[3]}))
if [[ -n "${BASH_REMATCH[4]}" ]]; then
  rc=$((10#${BASH_REMATCH[5]}))
  if (( rc < 1 || rc > 98 )); then
    echo "'$label': release-candidate number must be 1..98 (99 is reserved for the final release)" >&2
    exit 1
  fi
else
  rc=99
fi

if (( minor > 99 || patch > 99 )); then
  echo "'$label': minor and patch must be <= 99 to fit the versionCode scheme" >&2
  exit 1
fi
# Play's versionCode ceiling is 2100000000.
if (( major > 2099 )); then
  echo "'$label': major version too large for a Play versionCode" >&2
  exit 1
fi
if (( major == 0 && minor == 0 && patch == 0 )); then
  echo "'$label': 0.0.0 is not a releasable version" >&2
  exit 1
fi

echo "$major.$minor.$patch $(( major * 1000000 + minor * 10000 + patch * 100 + rc ))"
