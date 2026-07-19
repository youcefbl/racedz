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

echo "Starting ZidRun (app + Caddy HTTPS proxy)..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

echo "Deployment complete."
echo "App logs:   docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f app"
echo "TLS/Caddy:  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f caddy"
