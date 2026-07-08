# ZidRun load test — 1000 concurrent users

Proves whether the current single-instance architecture (one Next.js container +
Postgres on one 4GB box) can handle **1000 concurrent users** doing the three
real things users do: **navigate** (web + mobile), **record runs**, and act as
**engaged authenticated users**. The Capacitor mobile app hits the same API
routes as the website, so simulating that HTTP traffic covers both clients.

Tool: **[Grafana k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)** (free, open-source).

```
loadtest/
├─ docker-compose.staging.yml   # prod-parity staging stack (app + postgres)
├─ .env.staging.example         # copy → .env.staging, fill sandbox creds
├─ seed/
│  ├─ users-spec.mjs            # shared user list definition
│  ├─ seed-users.mjs            # create N verified RUNNER accounts in Postgres
│  └─ harvest-cookies.mjs       # log them all in → k6/data/users.json
├─ k6/
│  ├─ scenarios.js              # the test: browse / record / active
│  └─ lib/{config.js,users.js}  # env-driven knobs + user pool
└─ monitor.sh                   # sample container CPU/mem + DB connections
```

## Prerequisites

- A **separate** staging box, **same size as prod** (same Hetzner plan / vCPU /
  4GB). Identical resources are non-negotiable — a bigger box gives fictional
  numbers.
- `stg.zidrun.com` DNS → the staging box.
- k6 installed on a **different** machine (your laptop or a cheap cloud VM) — never
  run the load generator on the box under test.
- Node 20+ on whatever host runs the seed/harvest scripts.

---

## 1. Stand up staging (on the staging box)

```bash
cp loadtest/.env.staging.example loadtest/.env.staging
# edit .env.staging: strong POSTGRES_PASSWORD, fresh AUTH_SECRET,
# and SANDBOX/no-op creds for email, push (VAPID), OpenAI, payments.

docker compose -f loadtest/docker-compose.staging.yml --env-file loadtest/.env.staging up -d --build
```

Confirm: `curl -sI http://127.0.0.1:3004/` returns 200, and Caddy on the box
reverse-proxies `stg.zidrun.com` → `127.0.0.1:3004`.

**Seed prod-like data.** An empty DB responds far faster than a full one and
hides the bottleneck. Best: restore a **sanitized** copy of the prod DB (scrub
emails/PII). Minimum: the synthetic users below plus enough races/runs to be
realistic.

## 2. Seed the test users (from the repo root, host with Node)

Point `DATABASE_URL` at the staging Postgres (published on loopback `:5433`):

```bash
DATABASE_URL="postgresql://racedz:PASSWORD@127.0.0.1:5433/racedz" \
  node loadtest/seed/seed-users.mjs
```

Creates 1000 verified `loadtest+00001@zidrun.test` … accounts (idempotent).

## 3. Harvest session cookies

Logs every user in once (throttled) so k6 doesn't melt the box with 1000
concurrent bcrypt logins during the ramp. Writes `k6/data/users.json`.

```bash
BASE_URL="https://stg.zidrun.com" node loadtest/seed/harvest-cookies.mjs
```

## 4. Run the tests (from the load-generator machine)

Copy the `loadtest/k6/` dir (including the generated `data/users.json`) to the
generator machine, then:

```bash
# 4a. SMOKE — validate scripts + auth, no perf conclusions
BASE_URL=https://stg.zidrun.com PROFILE=smoke TARGET=10 \
  k6 run k6/scenarios.js

# 4b. LOAD — the target-proving run: ramp to 1000, hold 20m
BASE_URL=https://stg.zidrun.com PROFILE=load TARGET=1000 \
  k6 run --summary-export results/load-1000.json k6/scenarios.js

# 4c. STRESS — keep going past 1000 to find the real ceiling
BASE_URL=https://stg.zidrun.com PROFILE=stress TARGET=1000 k6 run k6/scenarios.js

# 4d. SOAK — 1000 for 2h: leaks, DB connection exhaustion, /api/track disk fill
BASE_URL=https://stg.zidrun.com PROFILE=soak TARGET=1000 k6 run k6/scenarios.js

# 4e. SPIKE — 100→1000 in 30s (race registration opens)
BASE_URL=https://stg.zidrun.com PROFILE=spike TARGET=1000 k6 run k6/scenarios.js
```

While each run is going, on the staging box:

```bash
./loadtest/monitor.sh      # tees CPU/mem + active DB connections to results/
```

### Cloudflare: run it twice

`stg.zidrun.com` is proxied through Cloudflare, whose caching / rate-limiting /
bot-challenge will shape (or block) your traffic. Do **two labelled runs**:

- **Origin-direct** (measures *your* stack — the number that answers "can it do
  1k"): bypass CF by resolving the host to the origin IP.
  ```bash
  ORIGIN_IP=<staging-box-ip> BASE_URL=https://stg.zidrun.com \
    PROFILE=load TARGET=1000 k6 run k6/scenarios.js
  ```
- **Edge** (measures the real user path): go through CF, but first whitelist the
  generator's IP in a CF WAF rule so you aren't rate-limited/challenged. Run the
  same command without `ORIGIN_IP`.

### GPS payload weight

Add `RUN_WITH_ROUTE=true` to make each run POST carry a ~200-point GPS route —
closer to a real recorded run and much heavier on the write path. Run once with
and once without.

### Optional real registrations

Set `RACE_ID=<id> RACE_CATEGORY_ID=<id>` to enable race-detail + register writes
in the active scenario (adjust the body in `scenarios.js` to your
`raceRegistrationSchema` if the app 400s).

---

## Pass/fail SLOs (in `lib/config.js`)

| Metric | Threshold |
|---|---|
| Error rate (`http_req_failed`) | < 1% |
| Latency p95 / p99 | < 800ms / < 2000ms |
| Run-record write p95 (`run_post_duration`) | < 1000ms |
| Checks passing | > 99% |

k6 exits non-zero if any threshold is breached — the run "fails".

## Reading results

- **k6 end-of-test summary**: `http_req_duration` p95/p99, `http_req_failed`,
  per-scenario tags, and `run_post_duration`.
- **`monitor.sh` CSV**: watch `pg_active_conns` and `app_mem`. The likely first
  bottleneck is **Postgres connections** (Prisma opens a pool per app instance;
  a single instance still caps out) and the **`/api/track` write on every
  navigation** hammering the same DB.

## If it can't hold 1000 (likely, on one 4GB box)

The fixes change the topology, so re-test the new shape afterward:

1. **Move Postgres to its own box** (stop app+DB fighting for 4GB).
2. **Add a connection pooler** (PgBouncer) in front of Postgres.
3. **Run multiple app replicas** behind Caddy — but first swap the in-memory
   rate limiter (`src/lib/rate-limit.ts`, already flagged as single-instance) for
   a **Redis-backed** store, or per-user limits break across replicas.
4. **Cache read paths** (`/`, `/api/races`) at Cloudflare / in-app.
5. Consider **sampling or batching `/api/track`** so navigation doesn't cause a
   DB write per page view.

## Cleanup

```sql
DELETE FROM "User" WHERE email LIKE 'loadtest+%@zidrun.test';
```
```bash
docker compose -f loadtest/docker-compose.staging.yml --env-file loadtest/.env.staging down -v
```
