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
