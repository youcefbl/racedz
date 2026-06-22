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

echo "Building RaceDZ image..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build app

echo "Starting PostgreSQL..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres

echo "Applying database migrations..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm app npm run prisma:deploy

echo "Starting RaceDZ..."
RACEDZ_ENV_FILE="$ENV_FILE" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d app

echo "Deployment complete."
echo "Check logs with: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f app"
