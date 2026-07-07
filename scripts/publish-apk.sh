#!/usr/bin/env bash
# Publish an Android APK so it downloads from https://zidrun.com/app/downloads/zidrunapk.apk
#
# Run this ON the prod host (Hetzner), from the repo directory, AFTER `git pull`
# (so Caddy has the /app/downloads route from the committed Caddyfile).
#
#   scripts/publish-apk.sh /path/to/zidrun-prod-debug-vX.Y.apk
#
# It copies the APK into the `app-downloads/` subfolder of the uploads volume (mounted
# RW in the app container, RO in Caddy), then reloads Caddy. The public filename is
# always zidrunapk.apk, so the download URL is stable across releases.
set -euo pipefail

APK="${1:?usage: scripts/publish-apk.sh <path-to-apk>}"
[ -f "$APK" ] || { echo "APK not found: $APK" >&2; exit 1; }

APP_CONTAINER="${APP_CONTAINER:-racedz_app_prod}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DEST_DIR="/app/public/uploads/app-downloads"

echo "→ copying $(basename "$APK") into $APP_CONTAINER:$DEST_DIR/zidrunapk.apk"
docker exec "$APP_CONTAINER" mkdir -p "$DEST_DIR"
docker cp "$APK" "$APP_CONTAINER:$DEST_DIR/zidrunapk.apk"

echo "→ reloading Caddy"
docker compose -f "$COMPOSE_FILE" exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
  || docker compose -f "$COMPOSE_FILE" restart caddy

echo "✓ published — verify with:"
echo "  curl -sI https://zidrun.com/app/downloads/zidrunapk.apk | grep -i 'HTTP/\\|content-type'"
echo "  (if it doesn't update, purge the Cloudflare cache for that URL)"
