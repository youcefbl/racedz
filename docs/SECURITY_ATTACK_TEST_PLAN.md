# ZidRun Security Attack-Test Plan

> This is a repeatable security-test procedure. It is not a progress tracker; status, owners,
> exceptions, and release decisions live only in [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md).

## Purpose

Prove, before public marketing and the next production release, that ZidRun resists the main web,
API, data, infrastructure, mobile, and abuse threats identified in `SEC-001`–`SEC-015`.

Security testing cannot prove that an application is perfectly safe. The release bar is:

- no open Critical or High findings;
- no exposed credentials, tokens, private user data, payment proofs, health data, precise GPS, database,
  or origin host;
- all authorization-negative tests pass across users, organizations, admins, and private files;
- rate limits, quotas, alerts, backups, restore, and containment are demonstrated;
- Medium findings have an owner, mitigation, expiry date, and explicit release approval;
- the exact tested commit is the commit promoted to production.

## Safety rules and scope

### Target policy

| Target | Allowed tests | Forbidden without explicit written approval |
|---|---|---|
| Local app at `http://127.0.0.1:3003` | Unit, integration, browser, negative authorization, fuzz, dependency, secret, and local container tests | No real user data or production secrets |
| Isolated staging at `stg.zidrun.com` or loopback `:3004` | ZAP active scan, controlled API fuzzing, k6 load/stress/soak/spike, upload abuse, auth abuse, and recovery tests | Production email, push, payment, OpenAI, or real personal data |
| Production `https://zidrun.com` | Passive headers/TLS, DNS/certificate, public metadata, robots/sitemap, public-route and safe privacy checks; one controlled test account only | Active exploit scans, brute force, destructive payloads, high-rate crawling, load tests, DB tests, upload flooding, or origin probing |
| Android signed candidate | Permission, storage, deep-link, account-switching, logout, token/logcat, WebView, and private-data checks | Real personal location/health/payment evidence in captured artifacts |

Never test a host unless its exact URL is listed in the run record. Never use a real user account,
real payment proof, real GPX route, personal email, production API key, or owner’s personal account in
an attack test. Stop immediately if a test reaches production data, sends an unexpected real message,
creates a real charge, or causes service degradation.

### Test identities and data

Create isolated synthetic fixtures:

- runner A and runner B;
- organizer A and organizer B in different organizations;
- admin and superadmin;
- blocked user, unverified user, MFA-enabled user, and expired-token user;
- synthetic payment proof, GPX, health/coach text, notification, support thread, group, race, and
  registration records.

Use `loadtest/docker-compose.staging.yml` for the production-parity isolated stack. Its staging
database, uploads volume, and cron behavior must be separate from production. If a sanitized production
dump is used for realism, scrub names, emails, phones, national IDs, payment fields, precise locations,
tokens, logs, and uploaded media before import; synthetic data is preferred.

## Phase 0 — prepare and prove isolation

Record the following before scanning:

- exact Git commit, app image digest, database migration state, tool versions, target URLs, tester,
  timezone, and start/end times;
- staging DNS, firewall, Cloudflare mode, Caddy route, and origin address;
- confirmation that email, push, payment, OpenAI, cron, and analytics integrations are sandboxed or
  disabled;
- fresh database/upload backup and a rollback/cleanup command;
- synthetic account IDs and a list of created test objects.

Recommended staging startup:

```bash
cp loadtest/.env.staging.example loadtest/.env.staging
# Fill with fresh secrets and sandbox/no-op provider credentials.
docker compose -f loadtest/docker-compose.staging.yml \
  --env-file loadtest/.env.staging up -d --build

curl --fail --silent --show-error -I http://127.0.0.1:3004/
docker compose -f loadtest/docker-compose.staging.yml \
  --env-file loadtest/.env.staging exec app npx prisma migrate status
```

Keep evidence outside the repository in an encrypted, access-controlled directory. Store only a
sanitized summary and result links in `EXECUTION_PLAN.md`; never commit scan databases, cookies,
tokens, screenshots containing personal data, exploit payloads, or raw logs.

## Phase 1 — source, dependency, secret, and image checks

Run these against the exact release commit and staging image. Pin tool versions or container digests
in the evidence; do not use an unreviewed floating scanner image for the final result.

```bash
npm ci
npm audit --audit-level=low
npm run lint
npm run typecheck
npm run test:all
npm run build

# Secret scanning; use a pinned Gitleaks release/container in the real run.
gitleaks detect --redact --no-banner --source .

# SAST and OWASP-oriented rules; review findings rather than suppressing them blindly.
semgrep scan --config p/owasp-top-ten --error .

# Filesystem, dependency, secret, and configuration scan.
trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL .

# Scan the built image after the staging build.
docker image inspect racedz-app:staging --format '{{.Id}}'
trivy image --severity HIGH,CRITICAL racedz-app:staging
```

Review manually for dependency confusion, install scripts, vulnerable transitive packages, unsafe
Prisma/raw SQL, debug/source-map artifacts, embedded credentials, `NEXT_PUBLIC_*` secrets, exposed
provider keys, and unsafe Docker capabilities/volumes. No scanner result is closed solely because it is
marked “accepted”; record the reason, compensating control, owner, and expiry.

## Phase 2 — external exposure and security configuration

### Local/staging port and service exposure

Run only against the approved staging host or loopback target:

```bash
nmap -Pn -sV --script http-security-headers,http-methods \
  -p 3004 127.0.0.1

# If staging is intentionally reachable through its approved public hostname:
nmap -Pn -sV -T2 --script http-security-headers,http-methods \
  -p 80,443 stg.zidrun.com
```

Expected result: only approved HTTP/HTTPS entry points are reachable; PostgreSQL, Docker, admin
interfaces, debug ports, and internal services are not public. A public origin-IP bypass fails the
release until the firewall is corrected.

### Headers, TLS, methods, and leakage

Run passive checks against staging and production:

```bash
TARGET="https://zidrun.com"
curl --silent --show-error --dump-header /tmp/zidrun-headers.txt \
  --output /tmp/zidrun-home.html "$TARGET/"

curl --silent --show-error --head "$TARGET/"
curl --silent --show-error -X OPTIONS -i "$TARGET/api/races"
curl --silent --show-error -X TRACE -i "$TARGET/"

# Check common accidental public artifacts; 404/410 is expected.
for path in /.env /.git/HEAD /server.js /_next/static/development/_buildManifest.js \
  /sitemap.xml /robots.txt; do
  curl --silent --show-error --output /dev/null --write-out "%{http_code} $path\n" "$TARGET$path"
done
```

Confirm:

- HTTPS redirects are canonical; HSTS, CSP, frame denial, nosniff, referrer, permissions, and cache
  headers are present and appropriate;
- no `Server`, `X-Powered-By`, framework version, stack trace, local path, source map, secret, internal
  hostname, owner identity, or debug route is exposed;
- TRACE and unnecessary methods are rejected;
- CORS is not wildcarded for credentialed requests;
- private responses are not publicly cached and payment/GPS/health media has no public static path;
- errors are generic to clients but useful and redacted in internal monitoring.

For the public domain, use a slow, non-invasive TLS checker such as a pinned `testssl.sh` release.
Do not run aggressive scripts against production.

```bash
docker pull drwetter/testssl.sh:latest
EVIDENCE_DIR="${SECURITY_EVIDENCE_DIR:?Set this to an encrypted directory outside the repository}"
docker run --rm -v "$EVIDENCE_DIR:/out" drwetter/testssl.sh:latest \
  --quiet --color 0 --logfile /out/testssl-zidrun.log https://zidrun.com
```

This is read-only: a standard TLS handshake/cipher negotiation plus a passive fetch of `/` for
headers. It does not brute force, fuzz, or send any state-changing request.

## Phase 3 — OWASP ZAP web and API testing

### Passive baseline: staging and production

Run the baseline scan first. It crawls and passively reviews responses; it must not be treated as an
authorization test.

```bash
ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:<pinned-version>"
SECURITY_EVIDENCE_DIR="${SECURITY_EVIDENCE_DIR:?Set this to an encrypted directory outside the repository}"
mkdir -p "$SECURITY_EVIDENCE_DIR"

docker run --rm --network host -t \
  -v "$SECURITY_EVIDENCE_DIR:/zap/wrk:rw" "$ZAP_IMAGE" \
  zap-baseline.py -t http://127.0.0.1:3004 \
  -r /zap/wrk/zap-baseline.html -J /zap/wrk/zap-baseline.json
```

Run the same passive procedure against production only after confirming the target URL. Review CSP,
cookies, cache behavior, forms, information disclosure, mixed content, and missing headers.

```bash
ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:stable"
SECURITY_EVIDENCE_DIR="${SECURITY_EVIDENCE_DIR:?Set this to an encrypted directory outside the repository}"
mkdir -p "$SECURITY_EVIDENCE_DIR/zap"

docker run --rm -v "$SECURITY_EVIDENCE_DIR/zap:/zap/wrk:rw" "$ZAP_IMAGE" \
  zap-baseline.py -t https://zidrun.com \
  -r zap-baseline.html -J zap-baseline.json -m 3
```

`-m 3` caps the passive spider at 3 minutes so the crawl stays light against a live production
site. No `--network host` is needed here (unlike the staging/loopback commands below) since the
target is a public HTTPS URL, not a local port. `zap-baseline.py` only crawls and passively
inspects responses — it never sends the active/attack payloads `zap-full-scan.py` does, so it is
the one ZAP mode this plan's target policy allows against production.

### Active scan: isolated staging only

Use a staging-only ZAP context with synthetic credentials and a low request rate. Include public pages,
login, registration, race detail/registration, organizer, admin, coach, support, uploads, and all API
routes. Configure the context to exclude logout, destructive deletes, real external callbacks, cron,
payment, provider webhooks, and any route that can send real notifications.

```bash
docker run --rm --network host -t \
  -v "$SECURITY_EVIDENCE_DIR:/zap/wrk:rw" "$ZAP_IMAGE" \
  zap-full-scan.py -t http://127.0.0.1:3004 \
  -m 10 -r /zap/wrk/zap-full.html -J /zap/wrk/zap-full.json
```

Use authenticated contexts for runner, organizer, admin, and superadmin separately. The scan must
prove both positive access and denial of another identity’s objects; a public crawl cannot prove that.
Investigate every Medium-or-higher alert and every 401/403/500 anomaly before closing the gate.

## Phase 4 — authorization, authentication, and privacy attack tests

These are focused browser/API tests using Playwright plus direct HTTP requests. Add durable tests to
the repository’s existing test suite where a regression would be costly.

### Authentication and session attacks

- credential stuffing and repeated wrong passwords: expect throttling, generic errors, no account
  enumeration, and an alert;
- registration, verification, reset, OAuth, and native handoff token replay, expiration, tampering,
  cross-account use, and open-redirect attempts: expect rejection and no session;
- logout, password change, MFA enable/disable, role change, and blocked-account transitions: old
  sessions/tokens must be revoked or revalidated as designed;
- test Secure/HttpOnly/SameSite cookie flags, idle/absolute session expiry, CSRF tokens, origin checks,
  and session fixation resistance;
- test MFA enrollment, recovery-code single use, replay, brute force, lockout, and phishing-resistant
  admin MFA enrollment; no recovery path may silently bypass the second factor.

### Authorization and tenant-isolation attacks

For every object-bearing endpoint, replace IDs, slugs, organization IDs, user IDs, category IDs, run
IDs, notification IDs, export URLs, and file paths with another test identity’s value. Verify denial for:

- runner A reading or changing runner B’s profile, runs, GPX, coach memory, sleep, nutrition, goals,
  support thread, notifications, payment proof, registrations, or exports;
- organizer A reading or changing organizer B’s races, categories, members, invitations, registrations,
  announcements, payment information, or files;
- runner/organizer accessing admin routes or changing roles/statuses/audit logs;
- admin accessing superadmin-only functions, if any;
- deleted, rejected, suspended, expired, and unpublished objects;
- direct Caddy/static URLs, range requests, cache replays, path traversal, and alternate encodings.

Expected result: server-side denial with no sensitive data in the body, headers, timing-sensitive error,
logs, notifications, or analytics. Confirm permitted actions still produce the expected audit record.

### Input and output attacks

Use harmless canary strings and bounded payloads to test:

- reflected/stored XSS in names, race fields, support, groups, social content, coach text, imported
  captions, and query parameters;
- SQL/NoSQL/template injection probes against all filters, IDs, sorting, and raw-SQL paths;
- SSRF attempts in social import, image/URL fields, redirects, and provider callbacks using only a
  controlled internal test endpoint; verify private-network and metadata addresses are blocked;
- malicious Markdown/MDX, CSV formula values, unsafe URLs, newline/log injection, oversized JSON,
  deeply nested JSON, invalid Unicode, and invalid enum/date/number values;
- prompt-injection text in runner-authored coach content, GPX metadata, imported captions, and notes;
  verify the model never reveals system prompts, secrets, hidden context, or another user’s data.

### Upload and privacy tests

Test empty, oversized, wrong-MIME, magic-byte spoofed, polyglot, malformed, animated, metadata-bearing,
and traversal-named image files. Verify re-encoding, metadata removal, quota enforcement, safe response
headers, non-executable storage, and no public access to private scopes. Confirm GPS EXIF is removed and
that payment proofs, GPX, health-adjacent media, and private avatars are never returned to another user.

## Phase 5 — abuse, resilience, and capacity tests

Use the existing isolated k6 stack and run the generator from a separate machine. Follow
[`loadtest/README.md`](../loadtest/README.md), not production.

Run in order:

```bash
BASE_URL=https://stg.zidrun.com PROFILE=smoke TARGET=10 \
  k6 run k6/scenarios.js

BASE_URL=https://stg.zidrun.com PROFILE=load TARGET=1000 \
  k6 run --summary-export results/security-load.json k6/scenarios.js

BASE_URL=https://stg.zidrun.com PROFILE=spike TARGET=1000 \
  k6 run --summary-export results/security-spike.json k6/scenarios.js
```

Only after smoke/load are safe, run stress and soak as described in the load-test procedure. Monitor
CPU, memory, file descriptors, PostgreSQL connections, disk, 5xx rate, queue/jobs, rate-limit behavior,
Sentry, email/push/OpenAI spend, and data integrity.

Separately test bounded abuse of login, reset, verification, uploads, registration, search, reports,
support, social actions, notifications, coach transcription/TTS, and exports. Verify edge and app
limits return 429 with safe `Retry-After`, do not leak whether an account exists, and do not allow one
user/IP to exhaust disk, database connections, AI budget, email quota, or notification delivery.

Race registration concurrency must prove no oversell, duplicate registration, negative capacity, or
partial payment state. Restore staging after the run and verify test data has not crossed the tenant
boundary.

## Phase 6 — database, backup, host, and container tests

Run with an operations owner and only against staging or an isolated backup environment:

- verify PostgreSQL is not reachable from the public internet and Docker port publishing does not bypass
  host firewall rules;
- inspect runtime, migration, backup, and read-only role grants; attempt disallowed schema/table actions
  using the runtime role and confirm denial;
- confirm TLS in transit, encrypted volumes, restricted file permissions, connection/time limits, and
  no secrets in process listings, images, logs, backups, or client bundles;
- inspect Docker as non-root, capabilities, mounts, network exposure, health checks, and Caddy routes;
- restore encrypted DB and uploads into an isolated environment, run migration/read/auth checks, verify
  media, and record RPO/RTO;
- simulate backup failure, disk pressure, database unavailability, provider failure, and app restart;
  confirm safe degradation, alerting, rollback, and no data corruption;
- validate origin firewall bypass resistance from an external network and rotate all test secrets after
  the exercise.

Do not attempt container escape, destructive ransomware simulation, or production database probing. Use a
qualified security consultant if those tests are required.

## Phase 7 — Android and release-artifact checks

On the signed candidate, verify:

- no secrets, test credentials, source maps, verbose WebView logs, internal URLs, or owner identity in
  APK resources, assets, strings, manifests, or logcat;
- deep links cannot be hijacked by an untrusted handler; callback URLs remain same-origin/allowlisted;
- logout/account switching clears WebView/session/native storage and notifications do not cross accounts;
- screenshots, share sheets, background notifications, GPX exports, and crash reports do not expose
  private data;
- debug flags, test endpoints, developer menus, cleartext HTTP, and unsafe WebView settings are absent;
- permissions are minimal and requested only when needed; location and microphone behavior matches the
  privacy policy and user choice.

Use `aapt dump badging`, `apkanalyzer`, `adb shell dumpsys package`, and sanitized `adb logcat` output.
Do not upload the APK or logs containing real user data to third-party scanners.

## Phase 8 — marketing and public-launch privacy gate

Before marketing, store submission, or influencer/demo distribution:

- scan screenshots, videos, PDFs, social posts, APKs, and press assets with `exiftool` and `strings`;
  remove EXIF GPS/device/usernames, local paths, test emails, tokens, QR codes, and real user content;
- use synthetic accounts and seeded races only; obtain written consent for any real testimonial/photo;
- verify public links, preview deployments, staging hosts, dashboards, object-storage URLs, error pages,
  Git repositories, package metadata, domain registration privacy, and social account recovery contacts;
- do not publish owner personal email/phone, home/location clues, admin screenshots, internal hostnames,
  provider dashboards, or unreleased security details;
- align website privacy policy, Android Data Safety, deletion URL, analytics disclosure, AI/provider
  disclosure, health/GPS/payment handling, support contact, and marketing copy;
- use privacy-conscious analytics/UTMs: no email, phone, national ID, precise GPS, payment proof,
  health text, raw query strings, or bearer tokens in URLs or events;
- prepare a security contact, incident response owner, takedown/rollback plan, and a pause rule for
  campaigns if monitoring or abuse controls are not healthy.

Marketing is not a reason to lower the security bar. The public announcement waits for the same tested
commit and the same privacy/security evidence as the production rollout.

## Run log

Dated entries for completed runs. Keep each entry factual and short — commands run, tool
versions/digests, and the result summary. Release status, exceptions, and what a finding means for
the go/no-go decision belong only in `EXECUTION_PLAN.md`, per the note at the top of this file.

### 2026-07-30 — Phase 2/3 passive checks against production

Scope: `https://zidrun.com` only, production-sanctioned passive checks (no active scan, no auth
abuse, no load, no port/origin probing). Tester ran both tools via Docker — nothing installed on
the host.

```bash
docker pull drwetter/testssl.sh:latest
docker pull ghcr.io/zaproxy/zaproxy:stable

# TLS / cert / header check (Phase 2)
docker run --rm -v "$EVIDENCE_DIR:/out" drwetter/testssl.sh:latest \
  --quiet --color 0 --logfile /out/testssl-zidrun.log https://zidrun.com

# ZAP passive baseline (Phase 3)
docker run --rm -v "$EVIDENCE_DIR/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://zidrun.com \
  -r zap-baseline.html -J zap-baseline.json -m 3

# Supplementary manual checks (Phase 2 headers/leakage recipe, run directly)
curl --silent --show-error --head https://zidrun.com/
curl --silent --show-error -X OPTIONS -i https://zidrun.com/api/races
curl --silent --show-error -X TRACE -i https://zidrun.com/
for path in /.env /.git/HEAD /server.js /_next/static/development/_buildManifest.js \
  /sitemap.xml /robots.txt; do
  curl --silent --show-error --output /dev/null --write-out "%{http_code} $path\n" \
    "https://zidrun.com$path"
done
```

**Image digests:** `drwetter/testssl.sh:latest` → `sha256:793683226511b2e3c64d4d5dad17b94d11c3b775f805e19049b9dfc420624ff9`;
`ghcr.io/zaproxy/zaproxy:stable` → `sha256:8d387b1a63e3425beef4846e39719f5af2a787753af2d8b6558c6257d7a577a2`.

**testssl.sh result:** Overall Grade **A+** (96/100). No vulnerable protocol/cipher: Heartbleed,
CCS, Ticketbleed, ROBOT, CRIME, POODLE, SWEET32, FREAK, DROWN, LOGJAM, BEAST, LUCKY13, Winshock, and
RC4 all came back "not vulnerable". TLS 1.2/1.3 only. Cert valid (Let's Encrypt, expires
2026-09-26). HSTS `max-age=63072000; includeSubDomains; preload` present. One informational note:
"BREACH — potentially NOT ok, gzip/deflate HTTP compression detected", tool's own caveat applies
("can be ignored for static pages or if no secrets in the page") since this was tested against `/`.
Cookies observed: 2/2 Secure, 2/2 HttpOnly (the Auth.js session cookies; `racedz-locale` isn't a
NextAuth cookie so testssl.sh didn't enumerate it here — found separately by the ZAP crawl below).

**ZAP baseline result:** 52 PASS, 0 FAIL, 15 WARN-NEW across a passive crawl of the public route
tree (home, races, blog, coach, organizers, runners, login/register/forgot-password,
uploads/race/*). No Critical/High. Findings reviewed:

| Finding | Disposition |
|---|---|
| `Server Leaks Information via "X-Powered-By"` | Real, already fixed in code (`next.config.ts` `poweredByHeader: false`); not yet deployed to production at scan time. |
| `Cookie No HttpOnly Flag` / `Cookie Without Secure Flag` / `Cookie Poisoning` on `racedz-locale` | Real. Fixed: added `Secure` (HTTPS-conditional so local dev keeps working); deliberately not `HttpOnly` since the settings menu reads/writes this cookie directly from client JS to sync locale without a server round trip. |
| `Strict-Transport-Security Header Not Set` on `/uploads/race/*` | Real gap in Caddy's `/uploads/*` block (had its own header set that didn't include HSTS, unlike the main app). Fixed in `Caddyfile`. Low practical risk since HSTS is origin-scoped and the main page load already sets it for the whole origin. |
| `Absence of Anti-CSRF Tokens` on login/register/forgot-password | Scanner false positive: it looks for a hidden `<input>` CSRF field; this app uses Next.js Server Actions (origin-header-based CSRF, framework-enforced) and Auth.js's own `__Host-authjs.csrf-token` cookie for the credentials flow, neither of which look like a form field to the scanner. Worth a direct cross-origin-POST test in Phase 4 rather than trusting the scanner's silence, but not a code change. |
| `User Controllable HTML Element Attribute (Potential XSS)` on `?lang=` | Confirmed false positive: reflected value is the `lang` attribute, which only ever holds `en`/`fr`/`ar` (validated by `isLocale()` before use anywhere) — not attacker-controllable free text. |
| CSP `Wildcard Directive` (`img-src ... https:`) | Intentional, already documented in `next.config.ts` (Google-hosted avatars). Accepted tradeoff. |
| `Content-Type Header Missing` on `/account`, `/admin`, `/login`, `/organizer`, `/register` | Benign: these are 307 redirects from the auth middleware guard with no body, so there's nothing to type. |
| `Re-examine Cache-control Directives` on `manifest.webmanifest`/`robots.txt`/`sitemap.xml`; `Non-Storable Content`; `Sub Resource Integrity Attribute Missing`; `Cross-Origin-Embedder-Policy Header Missing`; `Authentication Request Identified`; `Session Management Response Identified` | Informational/low, no action taken this round — public static assets, first-party same-origin scripts, and framework feature detection rather than exploitable issues. |

Fixes shipped: commit `ba0e5cd` (Secure cookie flag + Caddy HSTS). Raw `testssl.sh`/ZAP output kept
in the tester's local scratch directory, not committed to the repository or pasted here in full,
per this plan's evidence-handling rule.

**Not run this pass:** Phase 1 (needs `gitleaks`/`semgrep`/`trivy`, not installed anywhere yet),
Phase 3 active scan and Phases 4–6 (need the isolated staging stack — `stg.zidrun.com` doesn't
resolve yet; `loadtest/docker-compose.staging.yml` exists but wasn't started this round), Phase 5
k6 tests (`k6` not installed), Phase 7 (no signed candidate in this pass).

## Findings and release evidence

For each finding, record in the encrypted evidence store:

| Field | Required value |
|---|---|
| Identity | Finding ID, tool, tool version/digest, date, tester |
| Scope | Exact target URL/commit/image, environment, account role |
| Reproduction | Sanitized steps, request shape, response/status, screenshot if safe |
| Impact | Data/role/availability/cost impact and affected tenant boundary |
| Severity | Critical/High/Medium/Low with rationale |
| Resolution | Commit/configuration, retest result, or approved exception with expiry |
| Release decision | Block, fix-and-retest, or explicitly accepted residual risk |

Release evidence added to `EXECUTION_PLAN.md` must be concise: date, exact commit, tools/tests run,
important results, remaining exceptions, and links to the protected full report. Never paste credentials,
cookies, exploit payloads, private data, precise routes, or raw scanner output into the execution plan.

## Stop conditions

Stop the run, isolate the environment, and notify the incident owner if any of the following occurs:

- a test reaches production data or sends an unintended real email/push/payment/provider request;
- credentials, session tokens, private media, health data, payment proofs, precise GPS, or owner identity
  appear in a public response, URL, log, crash report, analytics event, or scan artifact;
- PostgreSQL, Docker, SSH, an internal admin interface, or the origin is publicly reachable;
- error rate, latency, memory, disk, database connections, provider spend, or notification volume becomes
  unsafe;
- a scanner triggers a suspected real vulnerability or a user/account boundary is crossed.

Contain, preserve sanitized evidence, rotate affected secrets, restore staging if needed, and do not
resume until the target and test data are verified again.
