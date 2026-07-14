# Social-Post → Race Draft — Feature Plan

**Goal:** Admin shares a social-media post (Instagram/Facebook image + caption). The system extracts
all race fields with a vision LLM, creates a **draft race**, and the admin reviews & publishes it.
Optimize for "as automatic as possible" — the human is a *reviewer*, not a data-entry clerk.

Legend (matches EXECUTION_PLAN.md): Effort S = <½ day · M = ~1–2 days · L = ~3–5 days · XL = 1–3 weeks

---

## 0. The one hard constraint (read first)

**Instagram/Facebook posts cannot be reliably auto-fetched by URL.**
- Server-side `fetch` of `instagram.com/p/<id>` returns a login wall, not the caption/image.
- Public oEmbed is deprecated; Graph API only exposes posts from **business accounts you own**.
- Third-party scrapers (Apify, RapidAPI) work but are paid, fragile, and against ToS.

**Therefore the design puts the human in the *ingestion* step (one tap/paste) and automates the
*extraction* step (the tedious part).** Trying to automate the fetch is where projects like this die.

---

## 1. Ingestion — how the post gets into the system (ranked)

| Method | UX | Robustness | Effort |
|---|---|---|---|
| **A. PWA/Android Share Target** ("Share → ZidRun") | 1 tap from Instagram → image + caption land in the import form | High | M |
| **B. Manual upload + paste** (upload screenshot(s), paste caption) | 2 actions | High | S |
| **C. URL best-effort fetch** (try oEmbed/scrape, fall back to B) | paste link | Low/fragile | M |

**Recommendation:** Build **B first** (works everywhere, no platform quirks), then **A** as the
"wow" path on mobile (you already have a PWA manifest + Capacitor app — Share Target is a manifest
`share_target` entry for the PWA and an `ACTION_SEND` intent filter for Android). Skip **C** unless a
specific need appears; keep it as a stretch that degrades to B.

> Note: multiple screenshots per post are common (carousel of distances/prices). Support **1–N images**
> in one import.

---

## 2. Extraction — vision LLM → structured draft (the automated core)

Reuse the **existing OpenAI Responses API + `zodTextFormat` pattern** in `src/lib/coach/openai.ts`
(structured output, `store: false`, cost accounting via `estimateCostMicroUsd`). Add one new module,
e.g. `src/lib/social-import/extract.ts`.

- **Input:** the uploaded image(s) as `input_image` parts + the pasted caption text as `input_text`.
  (The SDK already installed supports image parts; today the coach only sends text — this is the first
  vision call in the repo.)
- **Model:** vision-capable model via a new env `SOCIAL_IMPORT_MODEL` (default to a current vision model;
  keep the env-override convention the coach uses).
- **Output:** a Zod schema mirroring the race create payload, **plus a per-field `confidence`** and a
  `sourceQuote` (the caption snippet each value came from) so the review UI can highlight low-confidence
  fields. Fields to extract (map to `createPlatformRace` payload — see `src/app/admin/races/new/actions.ts`):
  - `title`, `description`
  - `raceType` (enum) — inferred from distances/keywords
  - `startDate` (+ `endDate?`), `registrationCloseAt?`
  - `wilaya`, `city`, `commune?`, `address?`
  - `categories[]`: `{ name, distanceKm, priceDzd?, startTime?, maxParticipants? }` (one per distance)
  - `organizerName`, `organizerUrl?` (the IG handle/link)
  - `contactPhone?`, `contactEmail?`, payment info (`baridiMobNumber?`, `ccpAccount?`, `ccpKey?`)
  - `maxParticipants?`, `elevationGainText?`, `conditions?`, `requiredDocuments?`
- **Prompt language:** posts are French/Arabic (RTL). Instruct the model to read both and output
  normalized values, keeping the original-language `description`.

### Normalization (do this deterministically after the LLM, not inside it)
- **Wilaya/city → canonical:** snap the model's guess to the official list in `src/lib/algeria.ts`
  (fuzzy match; handle FR/AR spellings e.g. "Tizi Ouzou"/"تيزي وزو"). Never trust a free-text wilaya.
- **Dates:** parse FR/AR month names + relative dates to ISO; **require a year** (reject/flag if the
  post omits it). Timezone = Africa/Algiers.
- **raceType from distance:** 5→`FIVE_K`, 10→`TEN_K`, 21→`HALF_MARATHON`, 42→`MARATHON`, >42→
  `ULTRA_TRAIL`, "trail"/"montagne" keyword → `TRAIL`, else `ROAD`/`OTHER`. (Mirror the mapping already
  in `scripts/import-coursealgerie.ts`.)
- **Prices:** strip "DA/DZD", thousands separators → integer DZD.
- **Phones:** normalize to a consistent format; detect Baridimob vs CCP from context words.

---

## 3. Image handling

- On import, **download/persist the uploaded screenshot(s)** into `/uploads/race/...` via the existing
  `saveImageUpload` (`src/lib/storage.ts`) so the draft has a `mainImageUrl` (first image).
- A poster screenshot is a *fine* placeholder but often has text overlays; flag in the review UI that the
  admin may want to replace `mainImageUrl` with a clean image. (Schema stores a single image only today.)

---

## 4. Draft → review → publish flow

Reuse the **existing status workflow** — do **not** invent a parallel system.

- Create the race via a path modeled on `createPlatformRace` (`src/lib/admin.ts`) but with
  **`status: "DRAFT"`** (or `PENDING_REVIEW`) instead of `PUBLISHED`, and tag provenance (see §5).
- **Review UI:** a new admin page `/admin/races/import` that:
  1. Ingest step (upload/paste or share-target landing).
  2. Shows a spinner while extracting, then renders the **existing platform-race form pre-filled** with
     extracted values, low-confidence fields highlighted, `sourceQuote` shown on hover.
  3. Admin edits → **Save as draft** or **Publish** (flips to `PUBLISHED`, reusing the approve path).
- All edits already flow through `RaceEditHistory` + `AdminAuditLog`, so provenance/audit is free.

---

## 5. Schema additions (small migration)

Add to `RaceEvent` (nullable, non-breaking):
- `importSource` (`INSTAGRAM | FACEBOOK | MANUAL | ...` enum or string) — where it came from.
- `importSourceUrl?` — the original post link (for admin reference + dedupe).
- `importRawText?` — the pasted caption (audit + re-extract).
- `importExtractionJson?` (Json) — full LLM output incl. per-field confidence (debugging + "why did it
  pick this").
- Optional: `importedByUserId?`, `importReviewedAt?`.

**Dedupe:** before creating, check for an existing race with the same `importSourceUrl` or a
title+startDate+wilaya near-match, and warn ("looks like you already imported this").

---

## 6. Automation levels (phasing)

- **Phase 1 — MVP (semi-auto), ~L:** Manual upload + paste (§1B) → vision extract (§2) → pre-filled
  existing form (§4) → save draft/publish. Normalization for wilaya/dates/raceType/prices. This already
  removes ~90% of the typing.
- **Phase 2 — one-tap ingest, ~M:** PWA + Android Share Target (§1A). This is the "share a post and it
  just appears as a draft" experience.
- **Phase 3 — polish, ~M:** confidence highlighting + `sourceQuote`, dedupe warnings, multi-image
  carousel handling, "re-extract" button, cost/usage accounting.
- **Phase 4 — stretch, ~M:** best-effort URL fetch (§1C) and/or a monitored inbox: forward a post to an
  email/WhatsApp number → auto-creates a draft (fully hands-off, but depends on a paid/ToS-sensitive
  ingestion channel — evaluate before committing).

**Total to a genuinely useful tool: Phase 1 + 2 ≈ 1 week.**

---

## 7. Cost / ops

- Vision calls are cheap per post (cents) but **gate behind SUPERADMIN** and rate-limit (reuse the
  `src/app/api/uploads` limiter pattern) so it can't be abused.
- Reuse `store: false` + usage accounting; log tokens/cost per import like the coach does.
- Note the current `OPENAI_API_KEY` is out of quota (per EXECUTION_PLAN.md ops item) — needs billing
  enabled before live testing.

---

## 8. Open decisions (need your call)

1. **Provider for vision:** reuse **OpenAI** (matches the repo, one key, cost accounting exists) vs. add
   **Claude vision** (`@anthropic-ai/sdk` + new key). *Recommendation: OpenAI, for consistency.*
2. **Draft status:** brand-new `DRAFT` (invisible until published) vs. `PENDING_REVIEW` (shows in the
   existing moderation queue). *Recommendation: `DRAFT` — these are admin-authored, not organizer
   submissions awaiting approval.*
3. **Scope of ingestion in v1:** just images+caption (robust), or also attempt URL fetch? *Recommendation:
   images+caption only in v1.*
4. **Which platforms:** Instagram + Facebook cover most Algerian race organizers — confirm, or add others.
