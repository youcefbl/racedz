# ZidRun — Pagination & Lazy-Loading Audit

Every user-facing screen and list-returning API route, checked for whether it paginates, caps, or
loads everything at once.

**Audited:** 2026-07-18 · **Method:** code read + empirical probes against a running server
(10,087 users · 108 races · 50 runs).

---

## Direct answer to the two you asked about

### Runs list — ❌ no pagination

| | |
|---|---|
| Page load | `getRunsScreenData(userId, **50**)` — `src/app/account/runs/page.tsx:21` |
| API | `GET /api/coach/runs` — `limit` only, clamped 1–100, default 50 |
| Offset / cursor | **None.** `getRunnerRuns(userId, limit)` has no `skip` parameter |
| "Load more" UI | **None** anywhere in the coach components |

**Verified empirically** — `offset` and `cursor` are silently ignored:

```
limit=5              -> 5 runs, first = "Perf test run 1"
limit=5&offset=10    -> 5 runs, first = "Perf test run 1"   ← offset ignored
limit=5&cursor=abc   -> 5 runs                              ← cursor ignored
limit=200            -> clamped to 100
```

**Consequence:** a runner with 80 runs sees 50 and cannot reach the other 30 through the UI at all.
Past 100 they are unreachable even via the API. This is *data the user can no longer see*, not just
a speed problem.

### AI coach conversation — ❌ no pagination, and worse

| | |
|---|---|
| Source | `getCoachDashboard` → `SELECT … FROM "CoachInteraction" … LIMIT **10**` (`src/lib/coach/service.ts:830-836`) |
| API | `POST /api/coach/interactions` only — **there is no `GET` endpoint at all** |
| "Load more" UI | **None** |

Three compounding issues:

1. **Hard cap of 10.** Only the 10 most recent interactions are ever sent.
2. **No way to fetch more.** Without a GET route, older conversation history is unreachable by any
   client code — it exists in the database and is simply never served.
3. **The visible count is often *below* 10.** `coach-conversation.tsx:40` filters out `FAILED`
   interactions *after* the cap is applied, so a runner who had three failed calls sees seven
   messages, not ten.

The code already acknowledges the limitation — `coach-dashboard.tsx:119` calls it "the interactions
window", and a separate server-side `analyzedRuns` map exists specifically to work around the cap
when linking runs to their analyses.

---

## Full picture

**11 of ~40 list surfaces paginate properly.** The healthy ones nearly all go through the shared
helper `src/lib/pagination.ts` (`parsePagination()`, default 25, clamped to 100).

| Verdict | Count | Meaning |
|---|---|---|
| ✅ Properly paginated | 13 | server-side `skip`/`take` + page UI, or cursor |
| 🟡 Capped, no way to see more | ~12 | bounded query, but older data unreachable |
| 🔴 Unbounded or fetch-all-then-slice | ~10 | no `LIMIT`, grows with data |

### ✅ The good — copy these

| Surface | Mechanism |
|---|---|
| `/account/feed` | **Cursor pagination done right** — `take: limit + 1` to derive `nextCursor`, 20 default / 50 max, plus a localized "Load more" in en/fr/ar (`src/lib/social.ts:154-183`, `feed-view.tsx:163`) |
| `/account/registrations` | `parsePagination`, 25/page |
| `/organizer/events`, `/organizer/events/[id]/registrations` | `parsePagination`, 25/page |
| All 10 `/admin/*` list screens | `parsePagination` or raw `LIMIT/OFFSET`, 25/page |

`/account/feed` is the reference implementation. Every fix below should look like it.

### 🔴 Unbounded / fetch-everything

| Surface | File | Problem |
|---|---|---|
| **`GET /api/races`** | `src/app/api/races/route.ts:10` | **Public, no auth, no limit.** Returns *every* published race as JSON. Measured: **61 races = 55 KB**; at 1,000 races ≈ 900 KB, at 10,000 ≈ 9 MB |
| **`/races` page** | `race-repository.ts:185` + `races/page.tsx:52` | `findRaceEvents` has **no `take`** — fetches every matching race with categories + organization, sorts in JS, then `.slice()` 10/page. Page 2 costs the same as page 1. Each `?q=` variant pins another full result set in `unstable_cache` |
| **`getRunnerRecords`** | `service.ts:881` | `findMany` over the runner's **entire** run history on every `/account/runs` and coach-dashboard load. Grows forever with tenure. (Selects 5 columns, not `route`, so it's not huge — but it should be a SQL aggregate) |
| Feed author resolution | `social.ts:156` | Loads **all** `Follow` rows to build an `IN (…)` list — before the correctly-paginated feed query |
| Support threads | `support.ts:97`, `:239` | All messages in a thread, both runner and admin views |
| Organizer members + invitations | `organizer.ts:522`, `:747` | Unbounded |
| Race announcements | `announcements.ts:25` | Unbounded |
| Admin user detail | `admin.ts:624` | Nested `registrations` + `organizations` unbounded per user |
| Admin race history | `admin.ts:1114` | Unbounded edit history |
| Admin org list | `admin.ts:703` | Orgs paginate, but nested `members` is unbounded per org |
| Analytics breakdowns | `analytics/queries.ts:148-150` | `getLanguageBreakdown` / `getDeviceBreakdown` / `getPlatformBreakdown` omit `limit` → `Prisma.empty`, no `LIMIT` emitted |
| `sitemap.xml` | `sitemap.ts:51` | All published races |
| `/blog` | `blog.ts:136` | All posts (filesystem MDX — fine today, grows with content) |

### 🟡 Capped but unreachable-beyond

| Surface | Cap | Note |
|---|---|---|
| `/account/runs` | 50 | see above |
| Coach conversation | 10 | see above |
| `/account/notifications` | `LIMIT 50` | no "older" affordance |
| `/account/coach/notes` | `LIMIT 50` | no more-affordance |
| `GET /api/me/registrations` | 200 | no page param |
| `GET /api/organizer/events` | 200 | no page param |
| Registrations CSV export | 10,000 | single response |
| `GET /api/coach/goals` | none | all goals for the user |

### 🐛 Three routes that paginate internally but pin page 1

These already have paginated data layers — the route handler just never passes the parameter, so
page 2+ is unreachable. Two of them **return `meta.totalPages`**, advertising pages they refuse to
serve.

| Route | File | Detail |
|---|---|---|
| `GET /api/organizer/events/[id]/registrations` | `route.ts:8-20` | Handler signature is `(_request, context)` — query params are never read. Calls `getOrganizerRaceRegistrations(orgId, id)` with no `pagination` arg, then returns `meta.page` and `meta.totalPages` |
| `GET /api/admin/races` | `route.ts:12` | `getAdminRaces({})` → `pagination ?? parsePagination()` → page 1, limit 25 |
| `GET /api/admin/organizations` | `route.ts:12` | `getAdminOrganizations({})` — same |

The data layers already accept `pagination?: PaginationParams` (`organizer.ts:285`,
`admin.ts:834`). This is a plumbing omission, not a design gap — likely a few lines each.

### ✅ Correctly bounded (no action)

`/rankings` (`TOP_N = 20` × 2 boards — a leaderboard *is* a top-N), homepage races (`take: 3`),
header notification bell (`LIMIT 6`), sleep (90-day window + `LIMIT 90`), nutrition (date-windowed),
coach dashboard sub-reads (runs 10, plans 2, sleep 90), subscription requests (10/20), admin
analytics top-lists (6–12), coach error log (30).

---

## Recommended order

1. **`GET /api/races`** — public, unauthenticated, unbounded. Add `take`/`skip` + total. Highest
   blast radius of anything here.
2. **`/races` page** — thread real pagination through `fetchRaceEvents` instead of slicing in
   memory. Same underlying fix as #1.
3. **Runs list** — add cursor pagination + "Load more", mirroring `/account/feed`. Users are
   currently losing access to their own history.
4. **Coach conversation** — add `GET /api/coach/interactions` with a cursor, and a "Load earlier"
   control. Also move the `FAILED` filter into the query so the cap isn't silently eroded.
5. **The three page-1-pinned routes** — cheap, and two of them are actively lying in `meta`.
6. **`getRunnerRecords`** — replace with a SQL aggregate or cache into the existing `CoachSnapshot`.
7. **Analytics breakdowns + support threads** — add `LIMIT`.

Items 1–2 are performance and cost. Items 3–4 are **users cannot reach their own data**, which is
arguably the more serious category even though it doesn't show up in a latency graph.

---

## Note on scope

This audit covers *whether* pagination exists, not whether the underlying queries are indexed.
`RaceEvent` still has **zero** `@@index` and `RaceRegistration` none for its hot paths (see
`docs/DEVICE_PERF_REPORT.md` §12b H3) — adding pagination to `/races` reduces rows transferred but
the seq scan remains until indexes land.
