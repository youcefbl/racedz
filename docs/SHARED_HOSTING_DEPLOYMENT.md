# Shared Hosting Deployment Guide

This guide is for testing the RaceDZ MVP on an internet-accessible subdomain with a low-cost shared hosting account.

## Important Reality Check

RaceDZ is not a static website and is not a PHP/FTP-only app.

RaceDZ needs:

- Node.js runtime.
- A running Next.js server process.
- PostgreSQL database.
- Environment variables.
- Writable upload storage, or a future object-storage provider.

If your shared hosting only gives you FTP and MySQL, it cannot run the current RaceDZ app correctly.

Your current MySQL database is not directly usable without a database migration project because the app currently uses:

- Prisma configured with `provider = "postgresql"`.
- PostgreSQL migrations.
- Raw PostgreSQL SQL in several helpers.
- PostgreSQL enum casts and JSONB fields.

For the fastest MVP internet test, keep the app on PostgreSQL and use your shared hosting only if it supports Node.js apps.

## Recommended MVP Path

Use:

- Shared hosting subdomain: `test.your-domain.com`.
- Shared hosting Node.js app feature, if available.
- External managed PostgreSQL such as Neon, Supabase, Railway, Render PostgreSQL, or a small VPS PostgreSQL.
- FTP or file manager only for uploading the built project archive if SSH/Git is not available.

Do not migrate to MySQL for the first MVP test. That is a separate engineering task.

## Check Your Hosting First

Ask your hosting provider or check cPanel for:

- `Setup Node.js App`, `Node.js Selector`, or `Application Manager`.
- Node.js version 20+ preferred.
- Ability to run `npm install`.
- Ability to run `npm run build`.
- Ability to set environment variables.
- Ability to set startup command, usually `npm run start`.
- Ability to bind the Node app to a subdomain.

If these are not available, use a cheap Node-friendly host instead:

- Render
- Railway
- Fly.io
- Hetzner VPS
- DigitalOcean droplet
- AWS Lightsail

## One-Command VPS Deployment With Docker

The repo includes a VPS-friendly Docker setup:

```txt
Dockerfile
docker-compose.prod.yml
.env.production.example
deploy.sh
Makefile
```

This setup runs:

- RaceDZ Next.js app container.
- PostgreSQL 16 container.
- Persistent Docker volume for PostgreSQL data.
- Persistent Docker volume for local uploads at `/app/public/uploads`.
- Prisma production migrations on startup/deploy.

Recommended VPS baseline:

- Ubuntu 22.04 or 24.04.
- Docker Engine with Docker Compose v2.
- At least 1 GB RAM for a small MVP test.
- 2 GB RAM if you want to build on the VPS comfortably.

On a fresh VPS:

```bash
git clone https://github.com/youcefbl/racedz.git
cd racedz
./deploy.sh
```

On the first run, `deploy.sh` creates:

```txt
.env.production
```

Edit it with real values:

```bash
nano .env.production
```

Required values to change:

```env
POSTGRES_PASSWORD=use-a-long-random-password
AUTH_SECRET=use-a-long-random-secret
NEXTAUTH_SECRET=use-a-long-random-secret
AUTH_URL=https://test.your-domain.com
NEXTAUTH_URL=https://test.your-domain.com
EMAIL_FROM=RaceDZ <notifications@your-domain.com>
RESEND_API_KEY=your-resend-key-if-email-is-enabled
```

Then run:

```bash
./deploy.sh
```

Or:

```bash
make deploy
```

Useful commands:

```bash
make prod-ps              # Show containers
make prod-logs            # Follow app logs
make prod-migrate         # Run Prisma production migrations
make prod-restart         # Recreate app container
make prod-backup-db       # Dump PostgreSQL into ./backups
make prod-backup-uploads  # Archive uploads into ./backups
make prod-down            # Stop the stack
```

The app listens on:

```txt
http://SERVER_IP:3003
```

For a real subdomain, put Nginx in front of it and proxy:

```txt
https://test.your-domain.com -> http://127.0.0.1:3003
```

Do not expose PostgreSQL publicly. The compose file keeps PostgreSQL internal to Docker by default.

### Docker Storage

The production compose file uses named volumes:

```txt
racedz_postgres_data
racedz_uploads
```

This means data survives container rebuilds and redeploys.

Back up both regularly:

```bash
make prod-backup-db
make prod-backup-uploads
```

For MVP testing this is acceptable. Before real production, move uploads to S3-compatible object storage.

## Subdomain Setup

In your hosting panel:

1. Create a subdomain:

   ```txt
   test.your-domain.com
   ```

2. Point the subdomain document root to a dedicated folder, for example:

   ```txt
   /home/USERNAME/racedz
   ```

3. Enable SSL for the subdomain.

4. Confirm this URL opens in the browser:

   ```txt
   https://test.your-domain.com
   ```

It may show an empty page or default page before the app is deployed.

## Database Setup

Use PostgreSQL, not MySQL, for this MVP.

Create a PostgreSQL database on a provider like Neon or Supabase and copy the connection string.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
```

If your provider requires pooled and direct URLs, use the direct URL for Prisma migrations.

## Production Environment Variables

On the shared host Node app settings, add:

```env
NODE_ENV="production"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"

AUTH_SECRET="generate-a-long-random-secret"
AUTH_URL="https://test.your-domain.com"
NEXTAUTH_SECRET="same-as-auth-secret-or-another-long-secret"
NEXTAUTH_URL="https://test.your-domain.com"

NEXT_PUBLIC_APP_NAME="RaceDZ"
NEXT_PUBLIC_APP_TAGLINE="Find, register, and manage races across Algeria."

UPLOAD_PROVIDER="local"
ADMIN_AUDIT_RETENTION_DAYS="31"

EMAIL_PROVIDER="resend"
EMAIL_FROM="RaceDZ <notifications@your-domain.com>"
RESEND_API_KEY="your-resend-key"

AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
NEXT_PUBLIC_FIREBASE_APP_ID=""
NEXT_PUBLIC_FIREBASE_VAPID_KEY=""
```

Generate a secret locally:

```bash
openssl rand -base64 32
```

Never upload `.env` to GitHub.

## Google Login Callback

If you enable Google login, add this authorized redirect URI in Google Cloud Console:

```txt
https://test.your-domain.com/api/auth/callback/google
```

For local development keep:

```txt
http://127.0.0.1:3003/api/auth/callback/google
```

## Prepare The App Locally

From your local project:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

If the build passes, create an upload package.

Upload these files/folders:

```txt
.next/
public/
prisma/
src/
scripts/
package.json
package-lock.json
next.config.ts
middleware.ts
tailwind.config.ts
postcss.config.mjs
tsconfig.json
```

Do not upload:

```txt
.env
node_modules/
.git/
public/uploads/*
```

Keep `public/uploads/.gitkeep` if the folder exists.

## Install On Shared Hosting With SSH

If your shared hosting provides SSH, use this flow on the server:

```bash
cd /home/USERNAME/racedz
npm install --omit=dev
npm run prisma:generate
npx prisma migrate deploy
npm run start
```

Some cPanel Node.js setups run the start command for you. In that case set:

```txt
npm run start
```

as the app startup command.

## Install On Shared Hosting With FTP Only

FTP-only deployment is risky for this app.

If your hosting has Node.js app support but no SSH:

1. Upload the project files through FTP or File Manager.
2. Open the hosting Node.js app screen.
3. Set app root to the uploaded folder.
4. Set startup file/command according to the host panel.
5. Use the panel button for `npm install`, if provided.
6. Use the panel terminal, if provided, to run:

   ```bash
   npx prisma migrate deploy
   ```

If there is no way to run `npm install` and `npx prisma migrate deploy`, the host is not suitable.

## Database Migration Command

For production or staging, use:

```bash
npx prisma migrate deploy
```

Do not use this command in production:

```bash
npm run prisma:migrate
```

`prisma migrate dev` is for local development.

## Local Uploads Warning

The MVP stores uploaded files in:

```txt
public/uploads
```

On shared hosting this means:

- Uploaded files live on that one server.
- Re-deploying by replacing `public/` can delete uploads if you are not careful.
- Backups are your responsibility.

For MVP testing, create this folder on the server:

```txt
public/uploads
```

Make it writable by the Node.js process.

Later production should move uploads to S3-compatible storage.

## Smoke Test After Deployment

Open:

```txt
https://test.your-domain.com
https://test.your-domain.com/races
https://test.your-domain.com/login
https://test.your-domain.com/register
```

Then test:

1. Login with seeded admin or create a new account.
2. Create/verify runner account.
3. Open race details.
4. Register for a race.
5. Confirm runner sees the registration in `/account/registrations`.
6. Admin can open `/admin`.
7. Organizer can open `/organizer`.
8. Image upload works if the server upload folder is writable.

If you can run terminal commands against the deployed app:

```bash
RACEDZ_BASE_URL="https://test.your-domain.com" npm run smoke
```

## MySQL Option

Using your existing MySQL database is possible, but it is not a deployment task. It is a migration project.

Required work:

1. Change Prisma datasource:

   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```

2. Recreate migrations for MySQL.
3. Replace PostgreSQL raw SQL casts such as:

   ```sql
   'PENDING'::"RegistrationStatus"
   ```

4. Replace JSONB-specific SQL.
5. Re-test Auth.js, notifications, invitations, audit logs, race edit history, registrations, and auto-cancel logic.
6. Re-seed data.

Recommended decision: do not use MySQL for the MVP internet test.

## Best Low-Cost Alternative

If shared hosting cannot run Node.js:

- Host the app on Render/Railway/Fly.io or a small VPS.
- Keep the subdomain on your existing domain.
- Point DNS CNAME/A record to the Node host.
- Keep PostgreSQL on Neon/Supabase/Railway.

This is usually faster and safer than forcing a full-stack Next.js app into FTP-only hosting.

## AWS Lightsail Size Recommendation

For a first internet MVP test, use Lightsail only for the Node.js app and keep PostgreSQL on a managed provider such as Neon or Supabase.

Recommended starting size:

```txt
$7/month
1 GB memory
2 vCPUs
40 GB SSD
2 TB transfer
```

Reason:

- The `$5/month` instance with 512 MB RAM is too tight for a Next.js app, Prisma, npm operations, and occasional build/start memory spikes.
- The `$7/month` instance is the lowest reasonable Lightsail size for a small RaceDZ MVP test.
- The `$12/month` instance is better if you want to run PostgreSQL on the same server, run builds directly on the VPS, or test with more users at the same time.

Do not run production PostgreSQL on the `$5/month` instance.

Suggested setup:

- Lightsail `$7/month` instance for the Next.js app.
- Managed PostgreSQL free/low-cost tier for the database.
- Existing domain/subdomain pointed to the Lightsail public IP.
- Nginx reverse proxy with HTTPS.
- PM2 or systemd to keep `npm run start` alive.

Upgrade to `$12/month` if:

- The app is slow under real testing.
- Builds fail because of memory.
- You want database and app on the same VPS.
- You expect multiple organizers and many runners testing during the same registration window.

## Final Checklist

- Shared hosting supports Node.js 20+.
- Subdomain has SSL.
- PostgreSQL database is ready.
- `DATABASE_URL` uses PostgreSQL.
- `AUTH_URL` and `NEXTAUTH_URL` use the public subdomain.
- Resend sender domain is verified if email is enabled.
- Google OAuth callback is updated if Google login is enabled.
- `npx prisma migrate deploy` has run successfully.
- `npm run start` is running.
- `public/uploads` exists and is writable.
- Manual smoke test passes.
