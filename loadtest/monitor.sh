#!/usr/bin/env bash
# Sample the staging box while k6 runs. On a shared 4GB box the failure mode is
# usually Postgres connections/memory or Node event-loop lag — NOT raw CPU — so
# watch active DB connections alongside container CPU/mem.
#
# Run ON THE STAGING HOST, in parallel with k6:
#   ./loadtest/monitor.sh
# Ctrl-C to stop. Output is tee'd to loadtest/results/monitor-<ts>.csv
set -euo pipefail

APP=${APP_CONTAINER:-racedz_app_staging}
PG=${PG_CONTAINER:-racedz_postgres_staging}
PGUSER=${POSTGRES_USER:-racedz}
PGDB=${POSTGRES_DB:-racedz}
INTERVAL=${INTERVAL:-5}
OUT=${OUT:-loadtest/results/monitor-$(date +%Y%m%d-%H%M%S).csv}

mkdir -p "$(dirname "$OUT")"
echo "ts,app_cpu,app_mem,pg_cpu,pg_mem,pg_active_conns,pg_total_conns" | tee "$OUT"

while true; do
  ts=$(date +%H:%M:%S)
  stats=$(docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' "$APP" "$PG" 2>/dev/null || true)
  app_line=$(echo "$stats" | grep -F "$APP" || true)
  pg_line=$(echo "$stats" | grep -F "$PG" || true)
  app_cpu=$(echo "$app_line" | cut -d'|' -f2); app_mem=$(echo "$app_line" | cut -d'|' -f3 | tr -d ' ')
  pg_cpu=$(echo "$pg_line" | cut -d'|' -f2); pg_mem=$(echo "$pg_line" | cut -d'|' -f3 | tr -d ' ')
  active=$(docker exec "$PG" psql -U "$PGUSER" -d "$PGDB" -tAc \
    "select count(*) from pg_stat_activity where state='active';" 2>/dev/null | tr -d '[:space:]')
  total=$(docker exec "$PG" psql -U "$PGUSER" -d "$PGDB" -tAc \
    "select count(*) from pg_stat_activity;" 2>/dev/null | tr -d '[:space:]')
  echo "$ts,$app_cpu,$app_mem,$pg_cpu,$pg_mem,${active:-?},${total:-?}" | tee -a "$OUT"
  sleep "$INTERVAL"
done
