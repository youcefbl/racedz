# ZidRun — Deployment Checklist (Staging → Production on Hetzner)

Goal: stand up **staging** first, validate the critical path, then promote the same build to **production**.
Stack: Next.js (standalone) + Prisma/PostgreSQL + Coolify on a Hetzner VPS, Cloudflare in front.

Legend: `[ ]` = do it · 🔴 = hard blocker (launch fails without it) · 🟡 = important · ⚪ = can wait.

---

## 0. Before you touch a server (have these ready)
- [ ] 🔴 A **domain** (e.g. `zidrun.com`) with DNS you can edit (Cloudflare account, free plan is fine).
- [ ] 🔴 **OpenAI API key** with billing enabled (you already have this).
- [ ] 🔴 **Email provider** account — Resend is simplest. Create an API key and **verify your sending domain** (DKIM/SPF). Without working email, nobody can verify their account or log in.
- [ ] 🟡 **Sentry** project (get the DSN) — optional but set it so you see prod errors from day one.
- [ ] ⚪ Google OAuth credentials (only if you want Google sign-in at launch).
- [ ] ⚪ Firebase project (only if you want web push at launch).
- [ ] Generate two strong secrets (one per env): `openssl rand -base64 32` → use for `AUTH_SECRET`.

---

## 1. Buy & harden the Hetzner VPS
- [ ] Create a **Hetzner Cloud** project → add a server. A **CX22** (2 vCPU / 4 GB) is enough to start (runs Coolify + 2 apps + 2 Postgres). Location: Nuremberg/Falkenstein (or Helsinki).
- [ ] OS: **Ubuntu 24.04**. Add your SSH key during creation.
- [ ] First login, then basic hardening:
  - [ ] `apt update && apt upgrade -y`
  - [ ] Create a non-root sudo user; disable root SSH + password auth in `/etc/ssh/sshd_config`.
  - [ ] Enable the firewall: allow `22, 80, 443` only (`ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`).
- [ ] Note the server's **public IPv4**.

---

## 2. Install Coolify
- [ ] Run the official installer (one command from coolify.io docs):
  `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
- [ ] Open `http://<SERVER_IP>:8000`, create the admin account.
- [ ] In Coolify: connect this server (it self-registers), and connect your **GitHub repo** (or use a deploy key) so it can build ZidRun.

---

## 3. DNS / Cloudflare
- [ ] In Cloudflare, add the domain. Point nameservers if not already.
- [ ] Add **A records** → server IP:
  - [ ] `staging.zidrun.com` (proxied / orange cloud)
  - [ ] `zidrun.com` and/or `app.zidrun.com` (add at production step)
- [ ] SSL/TLS mode: **Full (strict)** once Coolify has issued certs (Coolify uses Let's Encrypt).
- [ ] 🟡 Protect staging from the public + crawlers: add a **Cloudflare Access** policy (email-gate) on `staging.zidrun.com`, or at minimum keep it `noindex`.

---

## 4. Databases (two — never share)
- [ ] In Coolify, create a **PostgreSQL** resource for **staging** → copy its internal `DATABASE_URL`.
- [ ] Create a **second PostgreSQL** resource for **production** → copy its `DATABASE_URL`.
- [ ] 🟡 Turn on scheduled **backups** for the production database.

---

## 5. Deploy STAGING
- [ ] In Coolify, create a new **Application** from the ZidRun repo. Build pack: **Nixpacks** (auto-detects Next.js) or the repo Dockerfile if present. Build command `npm run build`, start command `npm run start` (the app already uses `output: "standalone"`).
- [ ] Set the domain to `https://staging.zidrun.com`.
- [ ] Paste **all env vars** (see "Staging env" below). Triple-check `AUTH_URL` / `NEXTAUTH_URL` = the staging URL.
- [ ] Deploy. Watch the build logs.
- [ ] 🔴 **Run migrations** against the staging DB: in a Coolify terminal/exec for the app container, run `npx prisma migrate deploy`.
- [ ] 🔴 **Create the admin user**: set `ADMIN_EMAIL` / `ADMIN_PASSWORD` env (temporarily) and run `npm run admin:create`, or run it as a one-off command.
- [ ] (Optional) seed reference data if you have a seed for races.

---

## 6. 🔴 Verify the critical path ON STAGING (the whole point)
Do these on `https://staging.zidrun.com` with real interactions:
- [ ] Register a new account → **a verification email actually arrives** (check spam too).
- [ ] Click the verification link → account activates.
- [ ] **Log in** with that account. (This is the make-or-break flow.)
- [ ] Browse `/races`, open a race, try a registration.
- [ ] Log in as admin → `/admin` loads, users list works, `/admin/coach` → search a user → **activate a subscription**.
- [ ] As that subscribed user → open the **AI coach**, send a text prompt (get a reply), and test **voice input** (mic prompt + transcription).
- [ ] Toggle theme + language; confirm they persist.
- [ ] Check **Sentry** received events (trigger a test error if needed).
- [ ] If using Google sign-in / push: test those too.

If email fails here, STOP and fix it before production — it's the #1 launch killer.

---

## 7. Promote to PRODUCTION
- [ ] Add DNS `zidrun.com` (and `www`) → server IP, proxied.
- [ ] Create a **second Coolify Application** from the same repo/commit, domain `https://zidrun.com`.
- [ ] Paste the **Production env** (different DB, different `AUTH_SECRET`, prod URL, prod email from-address). 
- [ ] Deploy → `npx prisma migrate deploy` on the **prod** DB → create the **prod admin**.
- [ ] Repeat the section-6 smoke test on the production URL (at least: register → email → verify → login).
- [ ] Remove the temporary `ADMIN_PASSWORD` env after creating the admin.

---

## 8. Post-deploy (first day/week)
- [ ] 🟡 Confirm **database backups** are running (prod).
- [ ] 🟡 Set up uptime monitoring (Cloudflare/UptimeRobot) on `zidrun.com`.
- [ ] ⚪ Decide on Google sign-in (needs the account-linking fix first).
- [ ] ⚪ Android app: separate track (Play Store) — point it at `https://zidrun.com`, rebuild a release APK, no `CAP_SERVER_URL` override.
- [ ] ⚪ Revisit deferred security items (allowBackup=false, admin MFA, CI pipeline).

---

## Env vars — what differs between Staging and Production
Full list/format is in `.env.example`. **Bold = MUST differ between the two envs.**

| Variable | Staging | Production |
|---|---|---|
| **`DATABASE_URL`** | staging DB | production DB (separate!) |
| **`AUTH_SECRET`** / `NEXTAUTH_SECRET` | unique secret A | unique secret B |
| **`AUTH_URL`** / `NEXTAUTH_URL` | `https://staging.zidrun.com` | `https://zidrun.com` |
| `EMAIL_PROVIDER` | `resend` | `resend` |
| `EMAIL_FROM` | `ZidRun Staging <staging@zidrun.com>` | `ZidRun <notifications@zidrun.com>` |
| `RESEND_API_KEY` | your key | your key |
| `OPENAI_API_KEY` | your key (or a capped staging key) | your key |
| `OPENAI_COACH_MODEL` | `gpt-5.4-mini` | `gpt-5.4-mini` |
| `OPENAI_TRANSCRIBE_MODEL` | `whisper-1` | `whisper-1` |
| `COACH_DAILY_AI_LIMIT` / `COACH_MONTHLY_AI_LIMIT` | `20` / `100` | `20` / `100` |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | same DSN (env-tagged) | same DSN |
| `NEXT_PUBLIC_APP_NAME` / tagline | as desired | as desired |
| `UPLOAD_PROVIDER` | `local` (or S3 later) | `local` (or S3 later) |
| Google / Firebase keys | only if testing them | only if enabling them |

> Reminder: never point staging at the production database, and never reuse the same `AUTH_SECRET` across envs.

---

## Quick reference — commands you'll run on the server (per app)
```bash
npx prisma migrate deploy        # apply DB migrations (run on each env's DB)
npm run admin:create             # create the SUPERADMIN (needs ADMIN_EMAIL/ADMIN_PASSWORD)
```

## Gotchas (learned the hard way)
- The app assumes **HTTPS** (HSTS, secure cookies, CSP) — always use the `https://` domain, not the IP.
- Set `AUTH_URL`/`NEXTAUTH_URL` to the **exact** public URL or login/email links break.
- If a deploy serves unstyled pages (CSS as `text/plain` / JS 404s), it's a stale build — redeploy clean.
- Email deliverability needs a **verified sending domain** (SPF/DKIM) or messages land in spam / get rejected.
