#!/usr/bin/env sh
set -eu

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Install Docker and rerun this script." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is not available. Install the Docker Compose plugin and rerun this script." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp .env.production.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.production.example."
  echo "Edit $ENV_FILE with real secrets, domain, and passwords, then run ./deploy.sh again."
  exit 1
fi

echo "Building ZidRun image..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build app

# Building on the production host accumulates BuildKit cache fast — a Next.js build leaves a couple of
# GB behind each time. On a small instance that silently fills the disk until Postgres cannot write,
# which is how a migration once failed mid-apply with "no space left on device". Keep a week of cache
# so incremental rebuilds stay quick, and drop the rest.
echo "Pruning stale build cache..."
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true

echo "Starting PostgreSQL..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres

echo "Applying database migrations..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app npm run prisma:deploy

# A Caddyfile that fails to adapt takes the whole edge down: Caddy serves every vhost from one
# process, so one bad `import` (or any other syntax error) means it crash-loops and NOTHING on
# the box is reachable — not just the site that changed. This happened for real (2026-08-30 to
# 2026-09-03, ~4 days undetected): a host-local Caddyfile edit dropped a snippet definition an
# `import` still referenced, `up -d` recreated Caddy with the broken file, and every subsequent
# deploy kept re-applying it without ever checking. Validating the file that is actually about to
# be mounted — not a copy, not what shipped last time — catches that before any container is
# touched, so `set -e` aborts here and the previous (working) containers are left running.
echo "Validating Caddy configuration..."
docker run --rm -v "$(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile

echo "Starting ZidRun (app + Caddy HTTPS proxy)..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

echo "Deployment complete."
echo "App logs:   docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f app"
echo "TLS/Caddy:  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f caddy"
