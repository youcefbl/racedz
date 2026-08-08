# Production smoke test — internal build on the M21, 2026-08-08

Read-only pass against **production** (`https://zidrun.com`) at the owner's request, signed in as the
owner's own account. Nothing was created, deleted or changed: no registration, no recorded run, no
setting or profile edit.

**No screenshots are kept.** The pass ran on a real account, and captures of Account, Profile,
Privacy and My-registrations carry that person's name, city, phone number and signed-in device
history. None of it is needed: every finding below rests on the API responses and the source, both
reproducible without touching anyone's data. The three `local-*.png` captures are the synthetic
`device.tester` fixture on the local stack, not production.

| Field | Value |
|---|---|
| Build | `dz.racedz.nativeapp.internal`, versionCode 8, versionName `0.8.0-internal` |
| Installed | 2026-08-08 09:59 |
| Device | Samsung SM-M215G, Android 13, wireless ADB |
| Backend | production, `https://zidrun.com` |
| Account | the owner's own production account (identity and figures deliberately not recorded here) |

## The two reported symptoms

### 1. "Continue with Google" errors — **product defect, fixed**

`/api/v1/auth/authorize` redirects a signed-out caller to the website's login page and built that URL
from the incoming request's origin. Behind the production proxy that origin is the address Next binds
to, so production answered:

```
location: https://0.0.0.0:3003/login?callbackUrl=...
```

The Custom Tab cannot reach that, so every signed-out runner attempting browser sign-in gets a
connection error. Reproduced directly against production with `curl`.

The environment is **not** misconfigured: on the very same response NextAuth resolved the correct
origin for its own cookie (`__Secure-authjs.callback-url=https%3A%2F%2Fzidrun.com`). Only this
hand-off read the origin from the request instead of from `NEXTAUTH_URL`/`AUTH_URL`, which is what
password reset, email verification, notifications and broadcasts already use.

Fixed in `3b9f4ca` with `canonicalOrigin()` plus `scripts/test-site-url.ts`. Verified locally by
replaying the production condition — requesting with `Host: 0.0.0.0:3003` now redirects to
`https://zidrun.com/login`. **Needs a deploy to take effect in production.**

### 2. Runs and Coach tabs missing — **configuration, not a defect**

Production is serving them off:

```json
"features": { "runs": false, "coach": false, "registration": true, "googleSignIn": true }
```

`/api/v1/config` derives these from `FEATURE_RUNS` / `FEATURE_COACH`, which default to **true** and
are only false when explicitly set. The app is honouring the remote kill switch exactly as designed;
production's environment has both disabled. Flipping them requires an env change and restart, not a
new build.

Worth noting: the Account tab still reports a run count and total distance for this account while the
Runs tab is hidden, so the data exists and is partly visible but unreachable.

## Further finding — truncated race descriptions with raw Markdown

Every imported race description is cut off mid-word and shows literal `**` to the runner. On
`trail-chrea-2026-15km-automne` the API returns 153 characters ending:

```
…avec une distance idéale pour **débuter en tr
```

This is **not** a rendering bug — the web renders the same field the same way
(`<p>{race.description}</p>`), so both surfaces show the same truncated text.

The chain:

1. `scripts/export_coursealgerie.py:196` takes the page's `<meta name="description">` — an SEO tag,
   conventionally capped near 155 characters and cut mid-word, carrying the source page's own
   Markdown.
2. Line 192 of the same file already extracts the full cleaned page text into `text`, and does not
   use it for the description.
3. `scripts/import-coursealgerie.ts:154` stores the value verbatim.

Fixing it means changing the scraper and re-scraping/re-importing, which rewrites live race
descriptions — left for the owner to decide rather than done against production data.

## Everything else

| Surface | Result |
|---|---|
| Cold start, Races list | renders real production races (Trail Chréa 15/24/40 km) |
| Race search | accepts input and returns results |
| Wilaya filter | renders |
| Race detail | renders, correct "Registration not open yet" state |
| Account | correct identity and season summary |
| My registrations | correct empty state |
| Privacy & data | renders; signed-in devices list correct, this device marked |
| Profile & preferences | renders with the account's real values |
| Crashes / ANRs | **none** |

Log warnings are benign: Gralloc version notices, lock-verification notices from a non-minified
build, and `OnBackInvokedCallback is not enabled` — the app has not opted into predictive back
(`android:enableOnBackInvokedCallback="true"`), which is a small gap worth closing separately.

**Status-bar contrast:** on race detail the hero photo is light while the app is in a dark theme, so
the clock and battery render light-on-light at the top of that screen. Marginal and image-dependent,
noted rather than claimed as a defect.
