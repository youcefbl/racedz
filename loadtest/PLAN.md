# Load-test plan — ZidRun @ 1000 concurrent users

> Goal: prove whether today's architecture (one Next.js container + Postgres on
> one 4GB Hetzner box) can handle **1000 concurrent users** doing the three real
> things users do — **navigate** (web + mobile), **record runs**, **engage** as
> authenticated users. Tool: **Grafana k6** (free). The scaffold is already in
> this `loadtest/` dir; this file is the checklist to run it when the server is ready.

---

## The strategy (why it's built this way)

- **Test a prod-parity staging clone, not prod.** `stg.zidrun.com` on a box the
  **same size as prod** (same 4GB / vCPU). Different size = fictional numbers.
- **Mobile = same API.** The Capacitor app hits the same routes as the website,
  so simulating the HTTP traffic covers both clients. No device farm needed.
- **Realistic mix, not a hammer.** 1000 *concurrent* users ≠ 1000 req/s. Model
  think-time. Split: **60% browse / 25% record runs / 15% active**.
- **Pre-harvest login cookies.** Login runs server-side bcrypt; 1000 concurrent
  logins would DoS the box itself. Log in once (throttled), replay cookies in k6.
- **Distinct user per VU.** The app's rate limits are per-user
  (`src/lib/rate-limit.ts`), so shared identities would false-throttle.
- **Beat Cloudflare two ways.** Origin-direct run (`ORIGIN_IP=…`) measures YOUR
  stack — the number that answers the question. Edge run measures the real path.
- **Watch the box, not just k6.** On 4GB shared, the wall is usually Postgres
  connections / memory and the `/api/track` write-per-pageview — not raw CPU.

---

## Test profiles (run in this order)

| Phase | Command flag | Shape | Purpose |
|---|---|---|---|
| Smoke | `PROFILE=smoke TARGET=10` | ramp to 10, ~1m | validate scripts + auth |
| **Load** | `PROFILE=load TARGET=1000` | ramp 5m → hold 1000 for 20m | **the target-proving run** |
| Stress | `PROFILE=stress TARGET=1000` | 1000 → 1500 → 2000 | find the real ceiling |
| Soak | `PROFILE=soak TARGET=1000` | 1000 for 2h | leaks, connection exhaustion, disk fill |
| Spike | `PROFILE=spike TARGET=1000` | 100 → 1000 in 30s | registration-opens rush |

**Pass/fail SLOs** (enforced by k6, defined in `k6/lib/config.js`): error rate
< 1%, latency p95 < 800ms / p99 < 2000ms, run-record write p95 < 1000ms, checks > 99%.

---

## Runbook (checklist)

### 0. Prereqs
- [ ] Staging box provisioned, **same plan as prod**.
- [ ] `stg.zidrun.com` DNS → staging box; Caddy proxies it → `127.0.0.1:3004`.
- [ ] k6 installed on a **separate** machine (laptop / cheap VM), NOT the box under test.
- [ ] Node 20+ on the host that runs the seed/harvest scripts.

### 1. Stand up staging (on the staging box)
- [ ] `cp loadtest/.env.staging.example loadtest/.env.staging`
- [ ] Edit `.env.staging`: strong `POSTGRES_PASSWORD`, fresh `AUTH_SECRET`, and
      **sandbox / no-op** creds for email, push (VAPID), OpenAI, payments.
- [ ] `docker compose -f loadtest/docker-compose.staging.yml --env-file loadtest/.env.staging up -d --build`
- [ ] `curl -sI http://127.0.0.1:3004/` → 200.
- [ ] Seed **prod-like data volume** (best: sanitized prod DB dump — scrub PII;
      minimum: the synthetic users below + realistic races/runs). Empty DBs lie.

### 2. Seed test users (repo root, host with Node)
- [ ] `DATABASE_URL="postgresql://racedz:PW@127.0.0.1:5433/racedz" node loadtest/seed/seed-users.mjs`
      (creates 1000 verified `loadtest+NNNNN@zidrun.test`, idempotent)

### 3. Harvest session cookies
- [ ] `BASE_URL="https://stg.zidrun.com" node loadtest/seed/harvest-cookies.mjs`
      (writes `loadtest/k6/data/users.json`)

### 4. Run (from the load-generator machine)
- [ ] Copy `loadtest/k6/` (incl. `data/users.json`) to the generator machine.
- [ ] Start monitoring on the box: `./loadtest/monitor.sh`
- [ ] Smoke: `BASE_URL=https://stg.zidrun.com PROFILE=smoke TARGET=10 k6 run k6/scenarios.js`
- [ ] Load (origin-direct — the real answer):
      `ORIGIN_IP=<box-ip> BASE_URL=https://stg.zidrun.com PROFILE=load TARGET=1000 k6 run --summary-export results/load-1000.json k6/scenarios.js`
- [ ] Load (edge — through Cloudflare; whitelist generator IP in a CF WAF rule first):
      same command **without** `ORIGIN_IP`.
- [ ] Optional heavier write path: add `RUN_WITH_ROUTE=true` (attaches ~200-pt GPS route per run).
- [ ] Then Stress → Soak → Spike as needed.

### 5. Read results
- [ ] k6 summary: `http_req_duration` p95/p99, `http_req_failed`, `run_post_duration`, per-scenario tags.
- [ ] `monitor.sh` CSV: `pg_active_conns` and `app_mem` — likely first bottlenecks.

### 6. Cleanup
- [ ] `DELETE FROM "User" WHERE email LIKE 'loadtest+%@zidrun.test';`
- [ ] `docker compose -f loadtest/docker-compose.staging.yml --env-file loadtest/.env.staging down -v`

---

## If it can't hold 1000 (expected on one 4GB box) — fixes in priority order

Each changes the topology, so **re-test the new shape** after applying:

1. **Move Postgres to its own box** — stop app + DB fighting for 4GB.
2. **Add PgBouncer** — connection pooler in front of Postgres.
3. **Run multiple app replicas** behind Caddy — but FIRST swap the in-memory
   rate limiter (`src/lib/rate-limit.ts`, already flagged single-instance) for a
   **Redis-backed** store, or per-user limits break across replicas.
4. **Cache read paths** (`/`, `/api/races`) at Cloudflare / in-app.
5. **Sample or batch `/api/track`** so navigation doesn't cause a DB write per page view.

---

## Open items to confirm before running
- Register-write body in `k6/scenarios.js` `active()` is best-effort — adjust to
  the real `raceRegistrationSchema` if the app 400s (it's gated behind
  `RACE_ID`/`RACE_CATEGORY_ID`, so ignore unless you enable it).
- Decide the staging data source: sanitized prod dump (preferred) vs synthetic seed.

_Full detail: `loadtest/README.md`. Scaffold validated (node syntax + compose config); k6 run not yet executed._
