ENV_FILE ?= .env.production
COMPOSE_FILE ?= docker-compose.prod.yml
COMPOSE = RACEDZ_ENV_FILE=$(ENV_FILE) docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE)

.PHONY: deploy prod-build prod-up prod-down prod-restart prod-logs prod-ps prod-migrate prod-seed prod-backup-db prod-backup-uploads

deploy:
	./deploy.sh

prod-build:
	$(COMPOSE) build app

prod-up:
	$(COMPOSE) up -d

prod-down:
	$(COMPOSE) down

prod-restart:
	$(COMPOSE) up -d --force-recreate app

prod-logs:
	$(COMPOSE) logs -f app

prod-ps:
	$(COMPOSE) ps

prod-migrate:
	$(COMPOSE) run --rm app npm run prisma:deploy

prod-seed:
	$(COMPOSE) run --rm app npm run prisma:seed

prod-backup-db:
	mkdir -p backups
	$(COMPOSE) exec -T postgres sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > backups/racedz-$$(date +%F-%H%M%S).sql

prod-backup-uploads:
	mkdir -p backups
	$(COMPOSE) exec -T app tar -czf - -C /app/public/uploads . > backups/racedz-uploads-$$(date +%F-%H%M%S).tar.gz
