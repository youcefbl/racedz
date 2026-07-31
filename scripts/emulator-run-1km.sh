#!/usr/bin/env bash
# 1 km due north at ~3.33 m/s, 1 fix/second. Longitude first, per `adb emu geo fix`.
# Due north is deliberate: 1 degree of latitude is ~111,320 m everywhere, so the recorded
# distance should land on 1000 m within a few metres. Anything further off is our maths.
set -euo pipefail
LAT=36.7538; LON=3.0588; DUR=300
for i in $(seq 0 $DUR); do
  CUR=$(awk -v lat=$LAT -v i=$i -v d=$DUR 'BEGIN{printf "%.7f", lat + (1000.0/111320.0)*(i/d)}')
  adb emu geo fix $LON $CUR
  sleep 1
done
