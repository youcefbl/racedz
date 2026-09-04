# ZidRun Operations and Deployment

This file explains **how** to operate and deploy ZidRun. Release status and outstanding actions live
only in [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md).

## Current production shape

- ZidRun is live at `https://zidrun.com` behind HTTPS/Cloudflare on owner-managed infrastructure.
- The app is Next.js standalone with PostgreSQL and Prisma migrations.
- A separate staging deployment is not required for the current release decision. Controlled
  acceptance must still use the exact commit that is promoted.
- Production email verification, Sentry/alerts, uptime monitoring, cron jobs, and OpenAI billing
  limits are operational.
- Local uploads are acceptable only on a durable, backed-up volume. Multiple app replicas require
  object storage and shared rate limiting first.

## Release procedure

### 1. Freeze and verify

```bash
git status --short
npm audit --audit-level=low
npm run lint
npm run typecheck
npm run test:all
npm run build
```

- Confirm every intended migration is reviewed and included.
- Record the exact commit and CI run in `EXECUTION_PLAN.md`.
- Back up the production database and verify the latest scheduled backup is readable.
- Identify the rollback application image/commit and whether the migration is backward-compatible.

### 2. Apply schema and deploy

Run inside the production application environment with production secrets already injected:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

Deploy the exact verified commit. If `Caddyfile` changed, reload the bind-mounted configuration after
the application deployment:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Create/bootstrap a superadmin only through the documented one-off command and remove any temporary
password environment variable immediately afterward:

```bash
npm run admin:create
```

### 3. Production smoke

- HTTPS, canonical redirects, CSP/security headers, and asset loading.
- Register → real email → verify → login.
- Race discovery and one controlled registration/cancellation path.
- Organizer and admin access/authorization.
- Coach text plus one safe provider request.
- Upload authorization and private payment-proof denial.
- Sentry release/event visibility, uptime monitor, cron health, database backup status.

Run the automated standalone smoke where applicable:

```bash
npm run smoke
```

### 4. Observe and approve

- Watch application/database logs, Sentry, uptime, email failures, AI usage/cost, and registration
  errors during the release window.
- Roll back on auth failure, data-integrity errors, migration failure, elevated 5xx, or mobile crash
  regression.
- Record evidence and the go/no-go decision in `EXECUTION_PLAN.md`.

### Required post-deploy check — legacy TTS audio purge

The production start command runs `npm run tts:purge-legacy` between `prisma:deploy` and the app
(`docker-compose.prod.yml`). It erases `public/uploads/tts-audio` on the persistent volume — audio
synthesized from ARBITRARY user text before the cue allow-list existed, which nothing reads any more.

It is deliberately **non-blocking**: access control is already in place (Caddy 403s both
`/uploads/tts-audio/*` and `/uploads/tts-cache/*`), so refusing to start the site over one
undeletable file would be disproportionate. That makes the log line the only signal, so checking it
is a required release step, not an optional one.

1. After the stack is up, read the app container's startup log:
   `docker compose -f docker-compose.prod.yml logs app | grep TTS_PURGE`
2. Expect exactly one of:
   - `TTS_PURGE_OK nothing to purge — <path> does not exist.` — already clean on a previous deploy.
   - `TTS_PURGE_OK removed N file(s), B byte(s) from <path>.` — record N and B as the before/after
     inventory in the `EXECUTION_PLAN.md` evidence row.
3. `TTS_PURGE_FAILED` means the directory survived. **Owner action, same release window:**
   `docker compose -f docker-compose.prod.yml exec app npm run tts:purge-legacy` and re-check. If it
   still fails, remove the directory from the volume directly
   (`docker run --rm -v racedz_uploads:/v alpine rm -rf /v/tts-audio`) and confirm the Caddy denies
   are live: `curl -sI https://zidrun.com/uploads/tts-audio/anything` must answer 403.
4. Not seeing any `TTS_PURGE` line at all is itself a failure — the deploy command was changed or
   the script did not run. Treat it as `TTS_PURGE_FAILED`.

Rollback is unaffected: the purge only deletes files no code path reads, so a rollback to a previous
image needs no restore. If the files are needed for a forensic reason, snapshot the volume BEFORE
deploying — the purge is not reversible.

## Secrets and environment

Required production groups are documented in `.env.example`. At minimum verify:

- `DATABASE_URL`
- `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Resend/email provider credentials and verified `EMAIL_FROM`
- OpenAI key/model/usage limits
- Sentry DSN and release environment
- Cron secrets
- Firebase server credentials when push is enabled
- Upload storage configuration

Never expose server credentials through `NEXT_PUBLIC_*`, reuse development secrets, commit `.env`, or
leave bootstrap passwords configured.

## Database least privilege (SEC-008, installed 2026-09-04)

The running app connects as `racedz_app`, a role with plain DML (`SELECT`/`INSERT`/`UPDATE`/`DELETE`)
on the `public` schema — not the `racedz` superuser Postgres was initialized with. An app-layer bug
(SQL injection, a bad raw query, anything that lets an attacker's input reach the database) is bounded
by that grant: it cannot create/drop tables, create roles, read another database, or touch anything
outside DML. Verified live: `CREATE TABLE` under `racedz_app` fails with `permission denied for schema
public`; real reads and writes through the deployed app succeed with zero permission errors.

Migrations still need DDL, so `prisma:deploy` alone runs with `DATABASE_URL` swapped to
`MIGRATE_DATABASE_URL` (the superuser connection) for that one step — see the `app` service's
`command:` in `docker-compose.prod.yml`. Everything else in that container, including the long-running
server, uses the restricted connection from `DATABASE_URL`.

**Role setup** (already applied to production; re-run after `prisma migrate reset` on any environment
that needs it, since a fresh database has no `racedz_app` role):

```sql
CREATE ROLE racedz_app WITH LOGIN PASSWORD '<APP_DB_PASSWORD>';
GRANT USAGE ON SCHEMA public TO racedz_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO racedz_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO racedz_app;
-- So a future migration's new tables (created by the superuser role) grant racedz_app access
-- automatically, with no manual follow-up grant after every migration:
ALTER DEFAULT PRIVILEGES FOR ROLE racedz IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO racedz_app;
ALTER DEFAULT PRIVILEGES FOR ROLE racedz IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO racedz_app;
```

`APP_DB_PASSWORD` lives in `.env.production` (root-only, 600) — generate with
`openssl rand -base64 33 | tr -dc 'A-Za-z0-9' | head -c 32`, same as the other secrets in that file.

Rehearsed before touching production: restored the latest encrypted backup into an isolated local
container, created the same role there, ran the actual app against it (public reads across several
tables, a real registration write), confirmed zero permission errors, only then applied to the live
database and cut the running container over.

## Backups on the production host (installed 2026-08-16)

- Script: `/usr/local/sbin/zidrun-backup.sh` (root only), cron `/etc/cron.d/zidrun-backup` at
  03:30 UTC daily. Log: `/var/log/zidrun-backup.log`; success stamp `/var/backups/zidrun/LAST_OK`.
- What: `pg_dump -Fc` of `racedz` and `zidsaha` + tar of the two uploads volumes, each gzip'd and
  encrypted with GPG AES-256 (symmetric) using `/root/.zidrun-backup.pass`; 14-day local retention
  under `/var/backups/zidrun/{db,uploads}`.
- **Owner actions still required:** copy `/root/.zidrun-backup.pass` to a password manager (a
  backup nobody can decrypt is not a backup) and add an offsite copy (Hetzner Storage Box / object
  storage via `rclone`) plus a failure alert on a stale `LAST_OK` — until then this is single-host.
- Restore (DB): `gpg -d --batch --passphrase-file /root/.zidrun-backup.pass FILE.dump.gz.gpg | gunzip |
  docker exec -i racedz_postgres_prod pg_restore -U racedz -d racedz --clean --if-exists`.
  Rehearse into a throwaway `postgres:16-alpine` container first (as done on 2026-08-16).
- Restore (uploads): `gpg -d … FILE.tar.gz.gpg | docker run --rm -i -v zidrun_racedz_uploads:/dst
  alpine tar -C /dst -xzf -`.

## Backup and restore acceptance

1. Confirm automated PostgreSQL backups, retention, encryption, and failure alerts.
2. Restore a recent backup into an isolated database.
3. Run `prisma migrate status`, a login/read smoke, and representative row-count checks.
4. Verify uploaded media backup/restore separately; a database-only restore is insufficient.
5. Record date, backup identifier, restore duration, operator, and result in `EXECUTION_PLAN.md`.

## Scaling boundary

Before running multiple application replicas:

1. Move uploads/private evidence behind object storage and authenticated delivery.
2. Replace process-local rate limits with a shared limiter or constrain the deployment to one app
   instance plus edge protection.
3. Add PgBouncer/connection budgets appropriate to PostgreSQL limits.
4. Run the existing k6 registration-open scenario and prove capacity cannot oversell.
5. Verify logs, jobs, notifications, and cron execution remain idempotent across replicas.

Do not migrate to AWS merely because an old plan exists. Choose infrastructure from measured traffic,
recovery requirements, team operating capacity, and total cost.

## Incident runbooks

- Algeria/Cloudflare reachability: [CLOUDFLARE_ALGERIA_REACHABILITY.md](CLOUDFLARE_ALGERIA_REACHABILITY.md)
- Runs crash/runaway recording: [RUNS_TAB_CRASH_INCIDENT.md](RUNS_TAB_CRASH_INCIDENT.md)
- Android build and device setup: [MOBILE_ANDROID.md](MOBILE_ANDROID.md)
- Verification matrix: [TESTING.md](TESTING.md)
