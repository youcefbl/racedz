# ZidRun AI Coach — Combined Review (Fable × Codex)

*Date: 2026-08-02 · merges `coach_review_fable.md` (Claude Fable 5) and `coach_review_codex.md`
(Codex, rev `abee6f1`). This file is an evidence-based combined assessment, **not a progress,
release-gate, priority, or roadmap tracker**. `EXECUTION_PLAN.md` remains the sole authority for
those statuses. The two source files remain deep-dive references (Fable: architecture map, prompt
rewrites, memory/context design, cost model, native-switch todo §9 · Codex: safety/consent
analysis, test plan §15, analytics/eval harness §14, open product questions §18).*

## 0. Cross-verification

The two reviews were produced independently. Before merging, every Codex P0/P1 headline claim
was re-verified against the code by the Fable reviewer, and Codex's coverage was checked against
Fable's findings:

| Codex claim | Verification |
|---|---|
| CR-001 chat text bypasses safety gate | ✅ **Confirmed** — `service.ts:1097-1104` passes selected/recent run + `goal.injuryNotes` into `evaluateCoachSafety`; `input.message` never enters it (`safety.ts:40-45` scans only run text) |
| CR-002 consent is unpersisted UI state | ✅ **Confirmed** — `coach-goal-form.tsx:86` `useState(isEdit)` (pre-checked on edit!), checkbox at `:461`; zero consent models/fields in `prisma/schema.prisma` |
| CR-004 dismissed memories can be re-learned | ✅ **Confirmed** — `memory-store.ts:58-63` supersedes only `ACTIVE` rows then inserts a new ACTIVE row unconditionally; the comment promising DISMISSED protection is not enforced; `deleteAllMemory` (`:186`) hard-deletes tombstones |
| CR-009 chat UI hides half the response schema | ✅ **Confirmed** — `coach-conversation.tsx:333-338` renders summary/progress/positive/warning only; `recoveryAdvice`/`usedSignals`/`dataGaps`/`followUpQuestion` are generated then discarded |
| CR-014 config/copy drift | ✅ **Confirmed** — admin page says "Free trial: 30 days"; `COACH_TRIAL_DAYS` defaults 7; `estimateCostMicroUsd` returns **0** for any non-`gpt-5.4-mini` model (`openai.ts:243`) |
| CR-003 planner ignores collected inputs | ✅ **Confirmed** — `targetTimeSeconds` never read; `targetDistanceKm` in `AdaptivePlannerInput` but unused (goal shape comes from `GOAL_PARAMS[goalType]`) |
| CR-006 goal edit leaves active plan untouched · CR-008 web draft-accept vs native auto-activate · CR-010 no idempotency key | ✅ All confirmed against `service.ts:267-305`, `saveDraftPlan` vs `ensureCurrentWeekPlan`, and both interaction routes |

**What each review uniquely contributed:** Codex found the safety/consent/idempotency/lifecycle
class of issues (governance & trust). Fable found the market/product class — Ramadan absence,
the darija prompt gap (darija is the *documented* Arabic register the AI was never told about),
the macro-plan invisibility, the prompt-structure problems, prompt-cache economics, and the
grounded cost model — plus the native-switch execution plan. One genuine disagreement is
recorded in §3. Both reviews independently reached the same core verdict:

> **The deterministic-planner-owns-the-numbers / model-only-explains split is right and must be
> kept.** The path forward is hardening state, safety, consent, and memory semantics — not a
> bigger model or an agent.

---

## 1. Combined executive summary

The coach is far beyond a chat wrapper: deterministic periodized planning with conservative,
tested load rules; post-generation safety enforcement that discards model workouts; structured
I/O; provenance-aware memory with runner controls; bounded context with hash/version tracing;
`store:false`; usage accounting; quotas; three locales; web + native clients. (Provider is
**OpenAI `gpt-5.4-mini`**, not Claude, contrary to the original brief.)

It is **not yet releasable as the flagship**, for two governance reasons (Codex) — and **not yet
sellable as the flagship**, for four product reasons (Fable):

**Release blockers (governance):**
1. Urgent symptoms typed into chat ("I fainted, chest pain") never reach the deterministic
   safety gate — the interaction is classified CLEAR and coached normally. (CR-001)
2. Health/body data is stored and sent to the provider with no auditable consent record —
   the checkbox is transient React state, pre-checked on edit. (CR-002; aligns with the
   EXECUTION_PLAN `SEC-002` blocker)

**Selling-point blockers (product):**
3. **No Ramadan/fasting awareness anywhere** — the most market-defining, mostly-deterministic
   feature available, absent (zero repo mentions). (Fable G2)
4. Onboarding is an 807-line form, not an interview; the coach's clarifying-question answers
   evaporate. (Fable G1 / Codex "progressive profiling")
5. The runner never sees more than one week — no roadmap to their race; `targetTimeSeconds` is
   collected and ignored. (Fable G4+G5 / Codex CR-003)
6. The AI's Arabic is MSA inside a product whose documented voice is Algerian darija. (Fable G11)

**Trust-erosion cluster (both):** "forget this" doesn't stick (CR-004), the UI hides the
rationale/recovery/follow-up fields that would make replies feel personal (CR-009), a goal edit
can leave a stale incompatible plan live (CR-006), web and native give different plan-commitment
semantics (CR-008), and duplicate taps can double-charge quota (CR-010).

**Cost:** not a constraint. ~$0.008/interaction on the mini model; ~$65/mo at a realistic
1,000-user mix; AI COGS ≈ 3–4% of subscription revenue. Spend more (auto weekly reviews ≈
$10/mo, extraction pass < $15/mo) rather than optimize — but fix the two accounting bugs
(unknown-model cost = $0; only static instructions ever cache-hit because the whole dynamic
context is one JSON blob).

---

## 2. Unified findings register

Severity: **P0** = blocker (release or selling-point) · **P1** = required for a credible
flagship · **P2** = important · **P3** = optimization. Source: F = Fable, C = Codex, F+C = found
independently by both. All C-items listed here were code-verified by F (§0).

| ID | Finding | Sev | Effort | Source |
|---|---|---|---|---|
| U-01 | Chat/free-text input bypasses deterministic safety triage (`input.message`, sleep text, goal-edit text) | P0 | S–M | C (CR-001) |
| U-02 | No persisted, versioned health/AI-processing consent; checkbox pre-checked on edit | P0 | L | C (CR-002) |
| U-03 | Ramadan/fasting: no schema field, planner input, or prompt rule — deadline ≈ Feb 2027 | P0 | L | F (G2) |
| U-04 | Onboarding = giant form; no progressive interview; follow-up answers not captured | P0 | L | F (G1) + C (progressive profiling) |
| U-05 | Dismissed/deleted memory facts can silently return (no suppression tombstones; delete-all removes them) | P1 | M | C (CR-04) |
| U-06 | Planner ignores `targetTimeSeconds`, `targetDistanceKm`, recent result, sleep, constraints — no feasibility read, no goal-pace bands | P1 | L | F (G5) + C (CR-003, broader) |
| U-07 | No macro plan: only the current week exists; `weeksToRace` computed then discarded; runner can't see the road to race day | P1 | L | F (G4) |
| U-08 | Goal edits (new injury, removed day) leave the active plan untouched and actionable | P1 | M | C (CR-006) |
| U-09 | Web (AI draft → accept) vs native (instant deterministic activation) plan lifecycles diverge | P1 | M | C (CR-008) |
| U-10 | Interaction POST has no idempotency key; ~12s synchronous generation; retries double-charge | P1 | M | C (CR-010) |
| U-11 | Chat UI discards `recoveryAdvice`/`usedSignals`/`dataGaps`/`followUpQuestion` — rationale invisible, follow-up unanswerable | P1 | S | C (CR-009) |
| U-12 | AI Arabic register: darija is the documented product voice (`COACH_DESIGN_FLOW.md:249`) but the prompt never says so; arabizi unaddressed | P1 | S | F (G11) |
| U-13 | Proactive touchpoints are static cron copy only; no AI weekly review, post-run reaction, or pre-race brief | P1 | M | F (G6) + C (P3.1) |
| U-14 | Safety taxonomy is narrow (few cardio regexes); no heat-illness/medication/eating-disorder classes, no minors/age policy (planner also age-blind — COACHPAR-004) | P1 | L | C (CR-012) + parity review |
| U-15 | Injury/health memory blocked pending SEC-002 policy — coach forgets injuries after the 6-turn window | P1 | policy + S | F (G3) + C |
| U-16 | Memory extraction under-captures: ≤3 candidates piggybacked on the coaching reply at low reasoning effort; runner-stated facts land as `AI_INFERRED` with no confirmation loop | P1 | M | F (G7) + C (CR-005) — see §3 |
| U-17 | No native memory/privacy surface and no `/api/v1/coach/memory`; voice/TTS unwired natively; `coach:false` kill switch is dead code | P1 | L | F §9 + C (CR-007/016) + COACHPAR-001/002 |
| U-18 | Config/ops drift: stale `.env.example` quota names, admin "30-day trial" vs 7-day code default, unknown model priced $0, `/api/coach/tts` unmetered | P1 | S | F+C independently (F: env+tts, C: admin copy + $0 pricing) |
| U-19 | No product-quality events or offline eval harness (safety recall, planner invariants, response rubric) | P1 | L | C (CR-013) |
| U-20 | Prompt-cache structural miss: whole dynamic context is one JSON blob — only the ~1.4k-token instructions ever cache; char-based (not token-based) compaction | P2 | S | F (G9) + C (context budget) |
| U-21 | One 37-rule prompt for all 4 interaction types; mandatory-warmth rules contradict the anti-repetition rule; duplicated rules | P2 | S | F (G14 + §6) |
| U-22 | Completion classification is distance-only; sleep/readiness never alters deterministic load | P2 | L | C (CR-011) + F (2.4) |
| U-23 | Structured quality workouts missing (no reps/sets — "repeat short hard efforts" prose) | P2 | M | F (G10) |
| U-24 | Conversation continuity thin: 6-turn summarized window, no thread/session concept | P2 | M | F (G8) |
| U-25 | PBs/streaks computed for badges but absent from coach context/memory | P2 | S | F (G12) |
| U-26 | Audit gaps: `CoachInteraction.acceptedAt` unused; deterministic weekly plans labeled `AI_ASSISTED`; selected memory IDs not traced per interaction | P2 | M | C (CR-017) |
| U-27 | No streaming/status lifecycle or deterministic fallback when provider is down | P2 | L | C (CR-015) |
| U-28 | Reminders: global schedules, no per-user quiet hours/preferred time | P3 | M | C (CR-018) |
| U-29 | Terrain/equipment/session-time never enforce the calendar (free text only) | P3 | M | F (G15) + C (CR-011/P2.4) |

---

## 3. Where the reviews disagree

**Memory provenance (U-16 / Codex CR-005).** Codex calls storing runner-stated facts as
`AI_INFERRED` "misleading provenance." The code comment (`service.ts:1262-1264`) defends it as
deliberate conservatism: the *fact* came from the runner but the *extraction* is the model's
reading, so it is stored as an inference with confidence attached — the safer direction of
error. **Merged position:** the labeling is defensible, the missing piece is Codex's
confirmation loop — store candidates as `PROPOSED`, surface "Remember this?" with edit/confirm
(the memory panel already exists), and only confirmed facts become `RUNNER_STATED`-grade
context. That resolves the provenance question and raises extraction quality at once, and it
composes with Fable's async extraction pass (dedicated cheap-model call on long CHAT turns,
rolling thread summaries) rather than competing with it.

**Center of gravity.** Codex: "the plan is the product; chat explains it." Fable: the
conversational coach *is* the selling point, and the deterministic plan is its spine. These
converge in practice — both reject chat-as-freeform-oracle and both want the plan visible,
diffed, and explained — but they cut differently on investment order: Codex sequences
governance → lifecycle → intelligence; Fable sequences the market-facing differentiators
(Ramadan, interview, macro plan, darija) as soon as the P0s clear. The merged roadmap (§5) does
both: governance first because it is small-to-medium effort and legally load-bearing, product
differentiators immediately behind it because they are what 1,000 Algerians will pay 790 DA/mo
for.

**Release posture.** Codex scores 6.2/10 and recommends staying behind the current hold until
CR-001/002 + lifecycle fixes land. Fable agrees on the two P0s but notes the platform maturity
(deterministic engine, memory substrate, ops accounting) is above what the score implies — the
gap is concentrated, not diffuse. Merged verdict: **fix U-01/U-02 (small + policy work), ship
the trust cluster (U-05/08/09/10/11), and the coach is credible; ship U-03/04/06/07/12/13 and
it is a selling point.**

---

## 4. What both reviews agree works well (keep, don't re-architect)

1. Deterministic planner owns every number; `enforceCoachSafety` replaces model workouts —
   the single best decision in the codebase.
2. Conservative, tested load rules (observed-volume anchoring, ≤10%+3km clamp, return-from-break
   ~55%, pain/fatigue/missed-session reductions, no catch-up mileage) — 68/68 planner tests pass.
3. Structured strict-schema I/O that fails closed; bounded context with section-presence
   metadata, versioning, and sha256 trace; `store:false`; explicit PII exclusions.
4. Prompt-injection defenses and memory-source semantics (RUNNER_STATED > HUMAN_COACH >
   SYSTEM_DERIVED > AI_INFERRED; REJECTED_SUGGESTION never repeated).
5. Server-side authority everywhere: ownership-scoped SQL, tiered quotas counting even failed
   calls, per-route rate limits, pre-model gates (topicality regex, safety block) that cost $0.
6. Run-reality capture: matching tiers (AUTO ≤15% / SUGGEST ≤40%), completion types, skip
   reasons, non-foot-activity exclusion, Algiers-calendar missed-session closing.
7. Runner-facing memory controls (view/confirm/dismiss/export/delete) — ahead of most shipped
   AI products, once U-05 makes "forget" durable.
8. Cost discipline: mini model, low reasoning effort, output caps, usage accounting with
   admin ops report; deterministic weekly rollover costs nothing.

---

## 5. Recommended sequencing (non-authoritative)

> **HISTORICAL (frozen 2026-08-03, per `DD6-R06`).** This section — including its checklists and
> the owner-decision quotes below — is a dated snapshot from when the sequencing was drafted. It
> is no longer advanced or corrected. Durable owner decisions live in `PRODUCT.md` ("Product
> decisions — AI coach and native app"); finding/gate status, evidence, and next priority live
> only in `EXECUTION_PLAN.md`. Checkbox states below reflect the snapshot date, not current truth.

*This synthesis does not supersede `EXECUTION_PLAN.md`; it only reconciles the two review
recommendations. Native-first: the mobile client is switching from Capacitor to `native-android/`
(owner decision 2026-08-02), so client work lands on native + additive `/api/v1`; Capacitor stays
the rollback path (`NATIVE-007`).*

> **Owner decisions (2026-08-02):** trial is **7 days** (admin copy was wrong, not the code) ·
> plan lifecycle is **instant deterministic activation + easy adjust** on both clients
> (acceptance reserved for material-change diffs) · consent is **scaffolded now** ahead of the
> SEC-002 policy text · work starts with **Tier 0 in full**.
>
> **Owner decisions (2026-08-02, second round):** **Ramadan mode → post-MVP** (next Ramadan
> ≈ Feb 2027; U-03 drops from the MVP path, deadline watch stays) · re-consent lands as a
> **hard gate now** (403 + guidance; no grace period during which health data flows without a
> current grant) · **delete-all = full erase, may re-learn** (Q9 closed: right-to-erase wins;
> per-fact Forget remains the never-relearn tool — UI copy should say so) · **MFA stays a web
> handoff permanently** (NATPAR-001 closed as a product decision: the hardened web
> /account/security flow is the one audited surface; the handoff token makes it land signed-in;
> mirror into `EXECUTION_PLAN.md`) · **TTS gets the full fix** (cue allowlist + private audio
> cache — T0-R03 to be closed properly, not deferred).

### Tier 0 — governance blockers — branch implementation reviewed, changes requested

- **U-01 Safety preflight on current input — implemented for live interaction text; not a closed
      release gate.** `containsUrgentSymptomText()` +
      `urgentSymptomDecision()` in `safety.ts`; scanned **before topicality and entitlement** in
      `createCoachInteraction` (a red-flag message previously could even be refused as
      *off-topic*, since "chest pain"/"faint" aren't in the topicality vocabulary); the live
      message is also appended to the CAUTION-level scan; BLOCKED row persisted (quota-free) as
      the audit record. Patterns cover EN/FR/Arabic script + curated arabizi/darija, incl. heat
      stroke. Golden set (18 urgent, 9 benign incl. collision controls) in
      `scripts/test-coach.ts` — passing. *Remaining: owner-reviewed escalation copy + broader
      taxonomy (§7 Q3), sleep-note scanning.*
- **U-02 Auditable consent (scaffold) — partial; findings `T0-R01`, `T0-R02`, and `T0-R04` remain.**
      `CoachConsent` model + enums + migration
      `20260802120000_coach_consent_and_unpriced_cost`; `src/lib/coach/consent.ts`
      (`COACH_CONSENT_POLICY_VERSION = "coach-consent-2026-08-v1"`, idempotent grant per policy
      version, withdrawal helper); the service can tag grants from goal create/edit as web/native,
      but only web currently transmits consent (`T0-R01`); `consent` added (optional/additive) to `createCoachGoalSchema`;
      form checkbox **never pre-checked** and required on create and edit, and now actually sent
      in the payload (it previously wasn't transmitted at all). *Remaining: SEC-002 policy text,
      enforcement, withdrawal UI.*
- **U-05 Memory suppression — partial; pure validation passes, but `T0-R05` remains.**
      `validateMemoryCandidates` takes a `dismissedSlots` set
      (rejects any candidate whose `(kind,key)` the runner dismissed, all sources);
      `writeMemories` fetches DISMISSED tombstones per user; 6 new pure tests (42/42 passing).
      *Deliberately kept: `deleteAllMemory` stays a full erase pending §7 Q9 (suppression
      shells vs right-to-erase).*
- **U-18 Config truth — partial; configuration copy is corrected, but `T0-R03` and `T0-R06`
      remain.** `.env.example` + `CODEX_CONTEXT.md` now name the real quota vars;
      admin "Pricing & limits" derives from `COACH_TRIAL_DAYS`/`COACH_TIER_LIMITS` (was
      hardcoded "30 days"); `estimateCostMicroUsd` returns **null** for unknown models,
      `AiUsageLog.estimatedCostMicroUsd` made nullable (same migration), ops report gains
      `ai.unpricedRequests`; `/api/coach/tts` now entitlement-gated (TRIAL+SUBSCRIBED allowed,
      NONE → 402).

> **Owner decision (2026-08-02): Capacitor is retired as a mobile target.** The native Android
> app is the only mobile client going forward; `/api/v1` compatibility constraints now protect
> the website and the native app, not the Capacitor wrapper. (Supersedes the "Capacitor remains
> the rollback path" framing above; `EXECUTION_PLAN.md` `NATIVE-008` is where the switch decision
> is formally recorded.)

### Tier 1 — trust cluster + native rails (parallel tracks)

*Server track — implementation evidence (2026-08-02, `feat/coach-tier0`; statuses are evidence,
not release-gate closures):*
- [x] **U-10 Idempotent interactions** — `clientRequestId` column + unique `(userId,
      clientRequestId)` (migration `20260802130000`); `requestId` in
      `coachInteractionInputSchema` (optional/additive); dedup lookup replays COMPLETED/BLOCKED,
      409s in-flight PENDING, reuses FAILED rows for retries; all three insert sites conflict-
      safe; web dashboard + runs-view send `crypto.randomUUID()` per ask. Status endpoint /
      async lifecycle still open (U-27).
- [x] **U-08 + U-09 One plan lifecycle (instant-activation variant per owner decision)** —
      `saveGeneratedPlan` activates AI-interaction weeks immediately (supersedes DRAFT+ACTIVE);
      web goal creation eagerly builds the first week like native; material goal edits
      (goal/date/experience/volume/days/injuries/conditions) supersede the current plan and
      rebuild it from the new answers. Still open: visible plan-diff UX, `acceptedAt`/labeling
      (U-26).
- [x] **U-11 Render the hidden fields** — recovery block, "Based on" chips, "Missing" chips,
      and the follow-up question with an Answer button that focuses the composer
      (`coach-conversation.tsx`); 5 new copy keys × en/fr/ar (parity green).
- [x] **U-12 + U-21 Prompt `coach-v11-2026-08-02`** — shared core + per-type suffixes
      (POST_RUN / INITIAL_PLAN / WEEKLY_REVIEW / CHAT), darija register rule, de-templated
      POST_RUN warmth, goal-time feasibility rule, duplicate rules merged; per-type
      `prompt_cache_key`.
- [x] **U-20 Cache-stable context `ctx-v2-2026-08-02`** — stable→volatile key order with the
      live request last. Token-based budget (vs 14k chars) still open.
- [x] **U-25 PERFORMANCE memory + records** — enum + migration `20260802140000`;
      SYSTEM_DERIVED PB facts written on run save (longest / best pace / 5K / 10K, after ≥5
      runs); all-time records block added to the context.

*Native track — implementation evidence (2026-08-02, `feat/coach-tier0`; Kotlin not compiled in
this session — owner compiles/migrates separately; statuses are evidence, not gate closures):*
- [x] **`/api/v1/coach/memory` + native memory screen** (COACHPAR-002) — additive route
      (GET list / `?export=1` raw export / PATCH confirm|dismiss / DELETE all, reusing the web
      handlers; deliberately not entitlement-gated — privacy surface); native `CoachMemoryScreen`
      + ViewModel + DTOs + repository methods, navigated from the Coach overview via
      `coach/memory`, with a second entry point on the locked/subscribe state so an expired-trial
      runner can still inspect and erase; per-fact "still true"/"forget", provenance + age pills,
      two-tap delete-all (RunDetail pattern); 17 `coach_memory_*` strings × en/fr/ar (native
      parity 487 keys green). *Open: export UX on-device (Custom Tab is cookie-auth; needs the
      NATPAR-002 handoff or an ACTION_SEND share), DB-backed cross-user negative test (T0-R07).*
- [x] **Real kill switch** (RUNPAR-006) — `/api/v1/config` now serves env-driven flags
      (`FEATURE_RUNS`/`FEATURE_COACH`, default **true**, documented in `.env.example`);
      `ZidRunApp` fetches the config once and `ShellBottomBar` filters the Runs/Coach tabs on the
      flags, failing OPEN on fetch failure (kill switch, not entitlement gate); Races/Account
      never gated (start destination + sign-out/privacy reachability).
- [x] **Dead controls hidden** (NATPAR-003) — manual entry + GPX import buttons, their params,
      wiring, and strings removed from the Runs overview until the real screens ship (per the
      tracker's "implement or hide" acceptance).
- [x] **TTS full fix (T0-R03 closed in code, per owner decision)** — `tts-allowlist.ts`: the
      endpoint synthesizes ONLY guided-run cue phrases (static pools enumerated from the real
      generators + bounded regex templates for split/rep/step phrases, en/fr/ar), refusing
      arbitrary prose with `400 UNSUPPORTED_CUE` before the provider is contacted; the audio
      cache moved to `/uploads/tts-cache`, 403'd by Caddy like the payment-proof scopes — the
      authed route is the only reader. Golden tests (allowed generators + refused prose) in
      `test-coach.ts`.
- [x] **Web-handoff token (NATPAR-002)** — `POST /api/v1/auth/web-handoff` (bearer) mints the
      same 5-minute single-use `NativeAuthToken` the WebView bridge uses; `GET /auth/handoff`
      exchanges it via the existing `native-bridge` credentials provider, signing the BROWSER in
      and forwarding to the sanitized internal `next` (failure degrades to login with the
      destination preserved). Native: `webHandoffUrl()` helper with plain-URL fallback; the
      subscribe, support, and security/MFA Custom Tabs now land signed-in — and the run GPX
      export was silently broken (bearer-only v1 URL in a browser → 401) and now goes through
      the handoff to the cookie-authed web route.
- [ ] Voice input + TTS in native composer (COACHPAR-001) — next; U-10 idempotency prerequisite
      now in place.
- [ ] Verify coach push delivery on native (rail for U-13).
- [ ] Production v1 endpoint probes as a release gate (Codex CR-007 — `404/405` drift; the new
      memory route must join the probe list).

### Tier 2 — the selling point (product differentiators, native-first UI)

- [ ] **U-03 Ramadan mode** — `observesRamadan` + `fastingTrainingPref` on `RunnerGoal`, Hijri
      util, deterministic timing/intensity rules, prompt block, one intake question.
      **Calendar-locked: well before ≈ Feb 2027.**
- [ ] **U-04 Progressive interview** — 6-field minimal form → `CoachThread(purpose: INTERVIEW)`
      + `CoachIntakeState.pendingSlots`, ≤2 asks/reply, answers land in structured columns or
      as `PROPOSED` memory (per §3's merged confirmation loop). Build the conversational UI in
      native `CoachOnboardingScreen`.
- [ ] **U-06 + U-07 Feasibility + macro plan** — validated-effort fitness estimate with
      confidence ("finish safely / stretch / build consistency" modes, never certainty);
      `TrainingBlock` table (goalId, weekIndex, phase, plannedKm, note) generated at goal
      creation, weekly plans linked to their block; native roadmap screen ("week 6 of 14 —
      build"); goal-pace bands only with a valid performance anchor (Codex invariant).
- [ ] **U-13 Proactive AI** — auto WEEKLY_REVIEW Sunday evening over the verified push rail
      (~$10/mo at target scale); one-line post-run reaction on plan-completing runs; pre-race
      brief when a linked `RaceEvent` is ≤7 days out. Respect quiet hours (U-28).
- [ ] **U-16 + U-24 Extraction pass + threads** — cheap-model extraction on long CHAT turns
      writing `PROPOSED` facts + rolling `CoachThread.summary` replacing the 6-turn window.
- [ ] **U-15 Injury memory** — flip INJURY_STATUS/RECOVERY_STATUS into the writable set behind
      the U-02 consent flag with default expiry; surface consent in the native memory screen.

### Tier 3 — depth (after measurement exists)

- [ ] **U-19 Eval harness first** — content-free events (Codex §14 table), provider stub,
      safety golden set, planner cohorts/invariants, response rubric; CI-blocking.
- [ ] **U-22 Readiness policy** — sleep trend + pain/fatigue + workload → deterministic
      load/intensity modifier with an explicit insufficient-data state; planned-vs-actual using
      duration/pace/RPE, not distance alone.
- [ ] **U-14 Safety taxonomy v2 + age policy** — broadened multilingual classes, minors
      decision, age-aware planner bands (COACHPAR-004 owner decision, pinned by
      `test-adaptive-planner.ts`).
- [ ] **U-23 Structured workouts** — `structure` JSONB on `TrainingWorkout` (reps/distance/
      pace/recovery), rendered natively, fed to guided audio; extend `workout-i18n`.
- [ ] **U-27 Async lifecycle + deterministic fallback**; **U-29 constraint-aware scheduling**;
      Codex P3.2 human-coach collaboration (authority rules: never above safety); P3.3 wearable
      imports (only after consent lifecycle + eval exist).

### Explicitly postponed (both reviews agree)

Autonomous model tool execution or direct plan mutation · medical diagnosis/prescription ·
embedding/vector retrieval before structured memory demonstrably misses facts · readiness-score
leaderboards · fully autonomous multi-week plan changes without runner review · any model
upgrade before U-19/U-20 make its effect measurable.

---

## 6. Combined quick wins (shippable this week, ordered by leverage)

1. **U-01 minimal form**: pass `input.message` into the existing `evaluateCoachSafety` text
   scan + add EN/FR/AR chat-only red-flag tests. (One-line data-flow change buys the P0's worst
   case while the full taxonomy is reviewed.)
2. **U-11**: render the four hidden response fields in `coach-conversation.tsx`.
3. **U-05 minimal form**: check for a DISMISSED row on `(userId, kind, key)` in
   `validateMemoryCandidates`/`writeMemories` before insert.
4. **U-18**: env names, admin trial copy, "unpriced" cost label, TTS entitlement gate.
5. **U-12**: the darija prompt rule (+ goal-time feasibility rule) — bump `COACH_PROMPT_VERSION`.
6. **U-10 minimal form**: accept a client `requestId`, unique-constraint it, return the existing
   row on conflict.
7. **U-08 minimal form**: on material goal edit, set the active plan's status to a
   needs-review state and surface a banner.
8. **U-25**: PERFORMANCE memory kind + PB write + records block in context.
9. **U-26**: persist `acceptedAt` on plan activation; label rule-based weeks `RULE_BASED` in
   the UI.
10. **CR-007 slice**: add production v1 coach-endpoint smoke probes to the release checklist.

---

## 7. Open decisions for the owner (merged)

1. Health-data legal basis, retention, provider-processing notice, and consent copy (gates
   U-02 → U-15). *(Codex Q1)*
2. Minors policy for the coach. *(Codex Q2)*
3. Reviewed Algeria-appropriate escalation wording (EN/FR/darija) for urgent-symptom blocks.
   *(Codex Q3)*
4. Intended trial length (7 vs 30 days) and final tier limits. *(Codex Q4)*
5. One plan-acceptance semantic for both clients — explicit accept everywhere, or documented
   native auto-activation? *(Codex Q5)*
6. Human-coach authority model (`humanCoaching` subscriptions exist; notes are advisory today).
   *(Codex Q6)*
7. **Ramadan mode scope for the 2027 cycle** — full planner integration vs prompt+timing-only
   v1. *(Fable)*
8. **Model strategy** — stay on `gpt-5.4-mini`, or A/B a stronger model for Arabic/darija reply
   quality once U-19 (eval) and U-20 (cache) land; the deterministic planner stays model-free
   either way. *(Fable; Claude mapping: Haiku 4.5 ≈ like-for-like ~$0.010/interaction, Sonnet 5
   ≈ ~$0.032 — both affordable at 1k users.)*
9. "Delete everything" promise vs suppression shells and audit records. *(Codex Q8)*

---

## 8. Source map

| Topic | Where the detail lives |
|---|---|
| Architecture map, request pipeline, file map | `coach_review_fable.md` §1 + appendix |
| Prompt critique + concrete rewrites | `coach_review_fable.md` §6 |
| Memory/context/thread schema proposals | `coach_review_fable.md` §5 + `coach_review_codex.md` §8 (consent/trace/tombstone models — adopt Codex's `CoachConsent`/`CoachMemoryEvent`/suppression states on top of the existing `CoachMemory`, **not** a new `UserFact`/`CoachMemoryFact` table) |
| Cost model with numbers | `coach_review_fable.md` §8 |
| Native-switch execution todo | `coach_review_fable.md` §9 (now sequenced by §5 above) |
| Safety/consent analysis | `coach_review_codex.md` §12 |
| E2E test scenarios (26) + DB integration tests | `coach_review_codex.md` §15 |
| Analytics events + eval harness | `coach_review_codex.md` §14 |
| Training-engine layer design + invariants | `coach_review_codex.md` §10 |
| Recommended runner journey | `coach_review_codex.md` §7 (adopted, with Fable's interview/Ramadan/macro-plan additions) |

---

## 9. Code review — `feat/coach-tier0`

### Review boundary and verdict

- **Base:** `main` at `abee6f1`.
- **Committed implementation reviewed:** `a18e9b9` (`feat(coach): Tier 0 governance fixes`).
- **Verdict:** **changes requested**. The safety preflight and pure memory checks are useful, but
  the branch does not yet close the consent, memory-control, TTS, or cost-truth findings it marks
  as implemented. No `SEC-*` or release gate should be closed from this branch review.
- **Worktree boundary:** additional Tier 1 prompt, response-rendering, and idempotency work appeared
  uncommitted while this review was running. It is not part of `a18e9b9` and is not counted as
  completed evidence below.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `T0-R01` | **P1** | **Native consent is never transmitted.** `CoachOnboardingScreen.kt:139,174-176,539-639` gates the button locally, but `CreateCoachGoalRequest` in `Dtos.kt:655-689` has no `consent` property. The server only records a grant when `input.consent === true` (`service.ts:200-208,322-329`). | Native goal create/edit can store health answers without creating the new native consent audit row, while the branch report claims web/native grants are persisted. | Add consent to the native request contract; send it only after an explicit action; add API/DB contract tests proving one `sourceClient=native` grant and proving omitted/false consent cannot enter the sensitive path. |
| `T0-R02` | **P1** | **Consent persistence is optional, non-atomic, and fail-open.** `createCoachGoalSchema` makes `consent` optional (`schemas.ts:61-64`). Goal health fields commit first; the grant is written afterward and any error is logged and swallowed (`service.ts:160-208`). The update path has the same split (`service.ts:291-329`). | A direct API caller or a transient DB failure can produce successfully stored/processed health data with no reconstructable consent grant—the exact state U-02 was meant to prevent. | Enforce the applicable consent or an explicitly non-sensitive mode server-side. Persist the goal/update and consent in one transaction, or fail without committing sensitive fields. Cover omitted, false, insert-failure, create, edit, web, and native cases with DB integration tests. |
| `T0-R03` | **P1** | **The TTS cost/privacy boundary remains open.** The new route check rejects tier `NONE`, but `/api/coach/tts` still accepts arbitrary authenticated text up to 200 characters, applies no Coach daily/monthly usage budget, writes no `AiUsageLog`, and returns public immutable audio backed by `public/uploads/tts-audio` (`route.ts:19-52`; `tts.ts:10-67`). | A trial or paid account can generate large numbers of novel billed/public audio objects, and admin cost reporting cannot see them. U-18 is therefore not implemented in full. | Accept allowlisted cue IDs/templates rather than arbitrary prose; enforce per-user/provider budgets; record cache miss/provider usage; store/serve the cache under the approved privacy policy rather than general public uploads. |
| `T0-R04` | **P2** | **The “active consent under the current policy” helper does not require the current policy.** `getActiveCoachHealthConsent()` filters purpose/status but not `COACH_CONSENT_POLICY_VERSION` (`consent.ts:47-55`). | A future enforcement call could treat a grant for superseded wording as current and skip required re-consent. | Filter by the current policy version or return an explicitly version-checked decision, with an old-version/re-consent test. |
| `T0-R05` | **P2** | **Dismissal suppression has no database/concurrency invariant.** `writeMemories()` reads dismissed slots before starting its write transaction (`memory-store.ts:43-65`); a concurrent dismiss/extraction can pass the pre-check and insert a new active row. `deleteAllMemory()` still deletes tombstones (`memory-store.ts:196-199`). The added 42-check suite exercises only the pure validator, not the DB path. | “Forget this” can still be undone by a race, and “delete all” still permits later re-learning despite U-05 covering both dismissed and deleted facts. | Decide delete-all semantics, then enforce suppression transactionally with a database-backed invariant/locking strategy and concurrent dismiss/write integration tests. Do not mark U-05 closed until both promises are explicit and tested. |
| `T0-R06` | **P2** | **Unknown-cost reporting remains misleading.** Failed `AiUsageLog` rows omit cost and are therefore counted as “unpriced” by `report.ts:95-103`, even for a known model. Meanwhile the primary admin Coach page still sums nullable costs to zero and shows no unpriced warning (`coach-admin.ts:77-100`; `admin/coach/page.tsx:77-88`). | The new count mixes provider failures with unknown pricing, while the main operator surface can still present a partial total as the full estimate. | Define unpriced as a successful request whose model lacks a price entry, expose the count/warning beside every displayed total, and test known-model failure, known-model success, and unknown-model success. |
| `T0-R07` | **P2** | **Tier 0 verification does not exercise the new integration boundaries.** The safety and memory additions have pure tests, but there is no route/service test proving urgent text bypasses entitlement without a provider call, no consent migration/create/edit/withdraw test, no native consent contract test, and no TTS entitlement/accounting test. The escalation copy and broader free-text taxonomy remain explicitly unapproved. | Passing unit checks can coexist with the native consent failure and the fail-open transaction split above. | Add isolated database/API contract tests for the stated guarantees and retain the owner-reviewed multilingual safety-copy/taxonomy gate in `EXECUTION_PLAN.md`. |

### Remediation of T0-R findings (2026-08-02, uncommitted at review time → next commit on `feat/coach-tier0`)

Evidence of code changes responding to the findings above — subject to the same rule that no
release gate closes without the tests the acceptance conditions name:

- **T0-R01** — `CreateCoachGoalRequest` (Dtos.kt) gains `consent: Boolean`; the onboarding screen
  transmits its existing consent tick and no longer auto-ticks it in edit mode (every save
  re-affirms, matching web). *Kotlin compile/device verification not run in this session.*
- **T0-R02** — consent is now enforced server-side: goal create **and** edit throw
  `400 CONSENT_REQUIRED` without `consent: true`, and the grant is written inside the same
  transaction as the goal insert/update (`recordCoachHealthConsent(userId, client, tx)`) — a
  stored goal without its grant can no longer occur in either failure order.
- **T0-R04** — `getActiveCoachHealthConsent` now filters by `COACH_CONSENT_POLICY_VERSION`; a
  grant under superseded wording reads as "re-consent required".
- **T0-R05** — the memory insert itself carries a `WHERE NOT EXISTS (… status='DISMISSED')`
  guard, closing the check-then-write race. Delete-all semantics remain an open owner decision
  (§7 Q9); DB-backed concurrency tests remain open (T0-R07).
- **T0-R06** — "unpriced" now counts only SUCCEEDED rows with NULL cost in both the ops report
  and `getCoachUsageSummary`; the admin cost card shows "(+N unpriced)" when the total is
  incomplete.
- **T0-R03 (partial)** — billed TTS synth calls (cache misses) are now capped per user per day
  (60) and recorded in `AiUsageLog` (SUCCEEDED/FAILED; cost NULL = unpriced by design, since TTS
  is character-priced). Still open: cue allowlisting and moving the audio cache out of public
  uploads.
- **T0-R07** — open: DB/API integration tests for these boundaries need a `DATABASE_URL`-enabled
  environment; pure suites, eslint, tsc (coach scope), and both i18n parity gates pass.

### Verification performed

- `node --import tsx scripts/test-coach.ts` — passed, including the 18 urgent / 9 benign text set.
- Coach context evaluation — passed.
- Adaptive planner — 68/68 passed.
- Coach memory — 42/42 passed.
- Workout structure — passed.
- Web i18n parity — 629 UI + 461 Coach keys across EN/FR/AR passed at the reviewed snapshot.
- Native i18n parity — 472 keys across EN/FR/AR passed.
- Targeted ESLint over the committed Tier 0 implementation files — passed.

### Not accepted or not tested

- No live OpenAI/TTS request, browser rendering capture, migration rehearsal, isolated DB integration,
  emulator, signed-device, TalkBack, performance, or production test was run for this review.
- The repository-referenced `impeccable` frontend review skill was unavailable. The five approved
  Coach v2 images were inspected at original resolution, but the changed web consent UI was not
  captured in a browser across themes/locales.
- The concurrently changing uncommitted Tier 1 work requires its own stable-commit review; its
  presence must not change the status of `a18e9b9` or any release gate.

---

## 10. Static code review — commit `b83a239`

### Review boundary and verdict

- **Reviewed commit:** `b83a2391e25b8a9cac6d54dcb5f18ab601f67638`
  (`feat(coach): Tier 1 trust cluster + Tier 0 review remediation`).
- **Parent:** `a18e9b9`.
- **Method:** static source/diff inspection only, at the user's request. No test, lint, typecheck,
  build, migration, database, browser, emulator, device, provider, or production command was run.
- **Verdict:** **changes requested.** The commit is a substantial improvement, especially the
  atomic goal/consent write, native consent field, current-policy lookup, cost-warning UI, prompt
  split, and richer web response rendering. It does not yet complete the consent-processing,
  idempotency, plan-lifecycle, memory-concurrency, or native-parity guarantees it claims.
- **Release status:** this code-only review closes no release or `SEC-*` gate.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `B83-R01` | **P1** | **Consent is enforced when a goal is written, but not when sensitive data is actually processed.** `getActiveCoachHealthConsent()` now checks the current policy (`consent.ts:62-71`), but it has no caller. `createCoachInteraction()` (`service.ts:1167-1420`) proceeds from the active goal to an OpenAI context containing body measurements, injury/health text, sleep, nutrition, and run notes without checking for a current grant. | Existing goals created before the consent migration, a withdrawn grant, or a future policy-version bump can still send health context to the provider. `T0-R02` and `T0-R04` are therefore only partially remediated. | Check the current active grant immediately before every provider-bound sensitive operation; require re-consent for legacy/superseded grants or build an explicitly non-sensitive context. Withdrawal or a policy bump must stop provider processing without deleting unrelated training history. |
| `B83-R02` | **P1** | **Goal edits do not invalidate a plan for every input the planner uses.** The `materialChange` predicate at `service.ts:340-349` omits `peakWeeklyDistanceKm` and `longestRecentRunKm`, although `buildAdaptivePlanForGoal()` passes both into the planner (`service.ts:934-935`) and the planner uses them to determine safe volume/long-run progression (`adaptive-planner.ts:268,330`). Other edited context fields are also omitted despite the comment promising that material edits rebuild the week. | A runner can correct their training history and save successfully while continuing to see and act on a week calculated from the old capacity. That undermines the edit-goal trust and safety promise. | Centralize a normalized plan-input fingerprint or compare every field consumed by the deterministic planner. Supersede/rebuild whenever that fingerprint changes, and separately define which health/context changes must pause or rebuild an actionable plan. |
| `B83-R03` | **P1** | **Interaction idempotency does not reach the native client.** The server accepts `requestId`, but native `AskCoachRequest` has only `type`, `message`, and `runId` (`Dtos.kt:539-543`); both native sends construct it without a key (`ConversationViewModel.kt:81,110`). The native request is deliberately synchronous and may remain open for up to 120 seconds. | A timeout followed by the runner's Retry creates a new interaction, provider call, and quota charge—the main mobile failure mode U-10 was meant to prevent. Web manual retries also create a fresh UUID per invocation rather than retaining one logical-operation key. | Generate one UUID when a logical ask/analyse action begins, retain it across timeout/auth/network retries, and send it from native and web until that operation settles or is explicitly abandoned. |
| `B83-R04` | **P1** | **Immediate plan activation is not atomic with completing/accounting for the interaction.** `saveGeneratedPlan()` commits and activates the new plan first (`service.ts:1420,1694-1732`); only afterward does a separate transaction mark the interaction `COMPLETED` and insert `AiUsageLog` (`service.ts:1423-1442`). The broad catch then labels any later database failure as an AI-generation failure. | The API can return an error and store a `FAILED` interaction even though the runner's active plan already changed. Retrying can call the provider and replace the plan again, while the successful provider cost is recorded as a failure without its real usage. | Commit the generated plan, interaction completion, and successful usage row in one database transaction, with a durable link from the interaction to its plan. Distinguish provider failure from post-provider persistence failure and make recovery/replay idempotent. |
| `B83-R05` | **P2** | **A retry of a failed idempotent request can become permanently `PENDING`.** The existing row is changed to `PENDING` at `service.ts:1203`, before active-goal, run-ownership, entitlement, metrics, context, and other preconditions are evaluated. Those operations sit outside the later provider `try/catch`. The key also has no normalized request fingerprint. | Any pre-provider rejection/error leaves the row hidden from history and all later uses of the key return `INTERACTION_IN_PROGRESS`. Reusing a key for a different payload can also replay or overwrite data for the earlier logical request. | Bind each key to a hash of normalized type/run/message and return 409 on a mismatch. Change state only after preconditions pass, make the transition conditional/transactional, and provide stale-`PENDING` recovery. |
| `B83-R06` | **P2** | **The dismissal insert guard does not fully close the race claimed by `T0-R05`.** `writeMemories()` supersedes the active row, then inserts when no dismissed tombstone exists (`memory-store.ts:69-95`). If a concurrent `dismissMemory()` targets the old active row after the writer has locked it, the dismissal waits; the writer sees no tombstone, inserts a new active row, commits, and the dismissal then marks only the old row dismissed. The new fact remains active. The function also reports `accepted.length` as written even when `NOT EXISTS` suppresses an insert (`memory-store.ts:98`). | “Forget this” can still lose to a concurrent extraction despite returning success, and callers can receive an incorrect write count. | Enforce one serialized slot-level invariant in the database/transaction—such as advisory/row locking plus a durable suppression record or a dedicated slot table—and return the actual inserted-row count. |
| `B83-R07` | **P2** | **Derived performance memory has no deletion/correction lifecycle.** A valid run can create global `PERFORMANCE` facts (`service.ts:598,1062-1091`), but `deleteRun()` only removes the run and reopens its workout (`service.ts:712-733`). Memory stores no `sourceRunId`, and no recalculation occurs. | Deleting a mistaken or private run can leave “longest run” or “best pace” in active memory, where the prompt explicitly tells the model to treat `SYSTEM_DERIVED` facts as true. It may also contradict the newly recomputed `records` block. | Store run provenance for derived facts and reconcile affected record slots on run deletion/correction, replacing them with the next valid record or removing them when no record remains. |
| `B83-R08` | **P2** | **The provider data contract was not updated for the new all-time `records` block.** `context.ts:115,170` adds total runs, total distance, bests, and streaks to every interaction context, while `docs/COACH_CONTEXT_DATA_CONTRACT.md` still claims to enumerate every field sent and contains no `records` entry. | Privacy/support review can no longer answer accurately what is transmitted, why, how sensitive it is, or how long its source data is retained. | Add `records` to the contract with source, purpose, sensitivity, bounds, and retention, and keep the context-version change tied to that reviewed contract. |
| `B83-R09` | **P2** | **U-11's transparency/follow-up UX is web-only even though native is the mobile target.** Web now displays `usedSignals` and an **Answer** affordance (`coach-conversation.tsx:370-404`). The v1 mapper deliberately strips `usedSignals` (`src/lib/api/v1/coach.ts:41-56`), native `CoachReplyDto` has no field for it, and native renders `followUpQuestion` as inert text (`ConversationScreen.kt:363-366`). | Native runners cannot see what evidence the answer was based on or act directly on the Coach's follow-up, so the trust/continuation feature is inconsistent across clients. | Carry the reviewed transparency fields through `/api/v1`, render them accessibly in Compose, and make the follow-up action focus the native composer without pre-filling or auto-sending content. |
| `B83-R10` | **P3** | **The new web follow-up action forces smooth scrolling without respecting reduced motion.** `answerFollowUp()` calls `scrollIntoView({ behavior: "smooth" })` at `coach-conversation.tsx:51-54`. | A runner who requested reduced motion still receives an animated viewport transition. | Use instant scrolling when `prefers-reduced-motion: reduce` is active, or rely on focus/scroll behavior that follows the shared motion policy. |

### Prior Tier 0 finding status at this commit

| Finding | Static status at `b83a239` |
|---|---|
| `T0-R01` | **Implemented in code:** native sends an explicit consent Boolean and edit mode no longer pre-checks it. Runtime/native verification was not performed. |
| `T0-R02` | **Partial:** goal and grant now share a transaction, but current consent is not enforced at the provider-processing boundary (`B83-R01`). |
| `T0-R03` | **Partial/open:** TTS now logs/caps cache misses, but the endpoint still accepts arbitrary text and returns publicly cacheable audio from `public/uploads/tts-audio` (`tts/route.ts:51`; `tts.ts:15-38`). The count-then-call daily ceiling and cache-miss generation are also not concurrency-reserved. |
| `T0-R04` | **Partial:** the lookup filters the current policy version, but no processing path uses the lookup (`B83-R01`). |
| `T0-R05` | **Open:** the insert guard improves the common ordering but does not establish the promised concurrent forget invariant (`B83-R06`); delete-all semantics remain an owner decision. |
| `T0-R06` | **Implemented in code:** failed rows no longer inflate the unpriced count, and the primary admin cost card displays incomplete totals. Runtime/database verification was not performed. |
| `T0-R07` | **Open:** this review intentionally ran no checks, and the commit still contains no new database/API/native-contract integration suite for the governance boundaries. |

### Remediation of B83-R findings (2026-08-02, on `feat/coach-tier0` after `e586def`)

Implementation evidence responding to §10's findings — same rule as always: no gate closes
without the tests the acceptance conditions name.

- **B83-R01** — `createCoachInteraction` now requires an ACTIVE grant under the CURRENT policy
  version before any provider-bound work (after the deterministic urgent preflight, which is
  never blocked by paperwork); missing/withdrawn/superseded grants → `403 CONSENT_REQUIRED`
  with re-consent guidance. The AI sleep-note parse enforces the same (manual fields stay free).
- **B83-R02** — the hand-picked `materialChange` list is replaced by `planInputFingerprint()`:
  a normalized fingerprint over every `AdaptivePlannerInput` goal field (incl. the previously
  missing `peakWeeklyDistanceKm`/`longestRecentRunKm`) plus the safety-gate health fields, with
  a KEEP-IN-SYNC marker tying it to the planner input type.
- **B83-R03** — `AskCoachRequest` gains `requestId`; the native `ConversationViewModel` mints
  one key per logical ask/analyse and retains it across retries until success. Web dashboard and
  runs-view now retain their key per logical payload (type|run|message) instead of minting per
  invocation.
- **B83-R04** — plan activation, interaction COMPLETED, and the SUCCEEDED usage row commit in
  ONE transaction (`saveGeneratedPlan` now runs inside the caller's tx); post-provider
  persistence failure is its own code (`COACH_PERSISTENCE_FAILED`) instead of masquerading as a
  provider failure while the plan had already changed.
- **B83-R05** — the FAILED→PENDING flip no longer happens before preconditions (only the final
  insert's ON CONFLICT flips it), so a rejected retry can't strand an invisible PENDING row; a
  reused key is validated against the stored type/runId/message and mismatches → `409
  REQUEST_ID_MISMATCH`.
- **B83-R06** — `dismissMemory` now dismisses the whole (kind, key) slot, not just the tapped
  row — a concurrently inserted duplicate of the rejected fact dies with it, closing the
  write-vs-dismiss race by outcome; `writeMemories` reports the rows actually inserted.
- **B83-R07** — `reconcilePerformanceMemory()` re-derives every PERFORMANCE slot from surviving
  runs after `deleteRun` (rewrite surviving slots, retire empty ones), so a deleted run's PB
  cannot linger as a SYSTEM_DERIVED "fact".
- **B83-R08** — `docs/COACH_CONTEXT_DATA_CONTRACT.md` gains the `records` row (source, purpose,
  sensitivity, bounds, deletion reconciliation) — and the previously missing `coachMemory` row.
- **B83-R09** — `usedSignals` now carried through the v1 mapper (comment updated: it is the
  reviewed transparency feature, not prompt internals); native `CoachReplyDto` gains
  `usedSignals`; ConversationScreen renders "Based on" and gives the follow-up question an
  Answer affordance that focuses the composer (never pre-fills or auto-sends). +2 strings ×3
  locales (native parity 489 keys).
- **B83-R10** — the web follow-up scroll honours `prefers-reduced-motion`.

Validation: pure suites, eslint, coach-scope tsc, web parity 629+461, native parity 489 — all
green. Kotlin changes not compiled in this session (owner compiles separately). Still open from
§10: T0-R03's cue allowlist/private audio cache, T0-R07 DB/API integration suites, delete-all
semantics (§7 Q9), escalation-copy review (§7 Q3).

### Static-review limitations

- The five approved Coach v2 screenshots were inspected as design references, but the commit was
  not rendered or compared in a browser/emulator. Theme, locale, RTL, large-text, keyboard,
  TalkBack/screen-reader, and visual fidelity are therefore unverified.
- Performance was not measured. Prompt-cache effectiveness, all-history record-query cost, and
  Compose/web rendering behavior are unverified.
- Migration behavior, raw-SQL transaction behavior, concurrency interleavings, and provider usage
  accounting were reasoned about from code, not executed.
- The repository-required ZidRun app-review skill was used. The referenced `impeccable` skill was
  unavailable.

---

## 11. Static code review — commit `19a58f3`

### Review boundary and verdict

- **Reviewed commit:** `19a58f3bc19a48b42e10b24e3865f8d4bf3c1c2b`
  (`fix(coach): remediate B83-R01..R10 — consent boundary, atomic persistence, idempotency
  retention, native parity`).
- **Parent:** `e586defbab34b73d4fe15f3b6570a0eda641fed0`.
- **Date:** 2026-08-03.
- **Method:** exact committed diff plus surrounding source/contract inspection only, at the user's
  request. No test, lint, typecheck, build, migration, database, browser, emulator, device,
  provider, or production command was run. The validation claims embedded in the commit and the
  remediation note above were not re-run or independently accepted here.
- **Verdict:** **changes requested.** The commit materially improves the original findings: goal
  invalidation covers the planner's stored goal inputs, request IDs reach native, the core plan
  write is in the interaction transaction, payload mismatches are rejected, the v1 transparency
  fields reach Compose, and reduced motion is respected. The consent, persistence-error,
  idempotency, memory-concurrency, and derived-memory guarantees are still incomplete.
- **Release status:** this code-only review closes no release, privacy, security, native-parity, or
  `SEC-*` gate. `EXECUTION_PLAN.md` remains the only status tracker.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `19A-R01` | **P1** | **The current-consent provider boundary still excludes Coach voice transcription.** `createCoachInteraction()` checks the current grant (`service.ts:1286-1299`) and the sleep-note parser now does likewise (`service.ts:1938-1953`), but `transcribeCoachVoiceNote()` calls `transcribeCoachAudio(file)` without any consent lookup (`service.ts:372-400`). Its route checks authentication, subscription, size, and MIME type only (`api/coach/transcribe/route.ts:15-46`). | A paid runner with no current grant—or one who withdrew or must re-consent after a policy bump—can send a Coach voice note containing symptoms, injuries, or other health data to the provider before reviewing its transcript. `B83-R01` is therefore only partially remediated. | Enforce an ACTIVE grant under `COACH_CONSENT_POLICY_VERSION` immediately before every provider-bound user-content operation, including transcription (or explicitly constrain it to a reviewed non-sensitive mode). Cover missing, withdrawn, old-version, and active grants at the route/service boundary before accepting the guarantee. |
| `19A-R02` | **P1** | **The intended persistence error is still converted into a provider failure.** The plan, interaction completion, and successful usage row now share one transaction (`service.ts:1488-1511`), which fixes the partial-plan commit. But its catch throws `COACH_PERSISTENCE_FAILED` (`service.ts:1512-1527`) inside the broader provider `try`; the outer catch catches that `CoachError`, converts every non-`CoachProviderError` to `COACH_GENERATION_FAILED`, overwrites the row, inserts a FAILED usage record without the real token/cost data, and returns 503 (`service.ts:1555-1576`). `TrainingPlan` also still has no durable source-interaction relation (`schema.prisma:637-656,807-841`). | A provider response that succeeded but cannot be persisted is reported and accounted as model failure, contrary to the commit claim. Operators lose the real provider usage/cost, clients receive the wrong recovery code, and there is no durable plan↔interaction link for reconciliation. | Restrict the provider catch to provider-call failures (or rethrow `CoachError` unchanged); handle persistence failure outside it; preserve/log the actual successful provider usage through a recoverable accounting path; and durably relate an AI-assisted plan to its generating interaction. |
| `19A-R03` | **P2** | **Failed-request claiming and stale-`PENDING` recovery remain non-idempotent.** Payload comparison is now correct (`service.ts:1212-1231`), but two concurrent retries can both read the same FAILED row, then both execute the unconditional `ON CONFLICT (id) DO UPDATE SET status='PENDING'` and proceed to the provider (`service.ts:1247-1252,1359-1373`). Separately, every existing PENDING row returns `INTERACTION_IN_PROGRESS` with no lease/age check (`service.ts:1232-1235`); a process termination after the insert leaves that key stuck indefinitely. | Concurrent retry delivery can still buy two provider calls for one logical request. A crashed worker can permanently strand the request ID and consume quota because PENDING rows are counted (`entitlement.ts:131-142`). `B83-R05` is improved but not complete. | Claim a FAILED row with one conditional atomic transition and proceed only for the winner. Add a processing lease/attempt timestamp and deterministic stale-PENDING recovery or reconciliation; verify concurrent retries and worker interruption against the database. |
| `19A-R04` | **P2** | **The slot-wide memory UPDATE still does not serialize “forget” with extraction.** The actual insert count is fixed, but the race remains: if dismissal starts while the writer holds the old ACTIVE row lock, the dismissal statement's snapshot cannot target a new row inserted after that statement began. The writer can supersede the old row, insert a fresh ACTIVE row, and commit; `dismissMemory()` then updates only rows visible to its original target scan even though its predicate now names the whole slot (`memory-store.ts:68-100,185-204`). | “Forget this” can still return success while a concurrently extracted copy remains ACTIVE and is sent in later Coach context. The implementation does not establish the privacy invariant claimed for `B83-R06`/`T0-R05`. | Serialize both write and dismiss on the same `(userId, kind, key)` lock (for example a transaction advisory lock or durable slot row), retain an authoritative suppression tombstone, and exercise both concurrency orderings in a database integration test. |
| `19A-R05` | **P2** | **Run-deletion reconciliation is best-effort with no durable repair path.** `deleteRun()` commits the run deletion first, then catches and only logs any `reconcilePerformanceMemory()` failure (`service.ts:713-721`). There is no dirty marker, retry job, on-read repair, or source-run relation on `CoachMemory`; the reconciliation itself rewrites/retire slots only when that one call succeeds (`service.ts:1108-1127`; `schema.prisma:696-728`). | A transient database error after deletion can leave the deleted run's PB fact ACTIVE indefinitely, while the independently recomputed `records` context says something else. The contract's “reconciled on run deletion” statement is not guaranteed. | Make deletion plus derived-memory state atomic where practical, or durably enqueue/mark reconciliation and retry it; alternatively derive these facts at read time. Preserve enough provenance to audit which run established a SYSTEM_DERIVED record. |
| `19A-R06` | **P2** | **Client retry retention ends before the reply is safely visible, and native chat exposes no direct retry.** Web clears `askKeyRef` immediately after the POST and before `refresh()` (`coach-dashboard.tsx:99-119`). Native clears its retained key before `reload()`, silently ignores reload failure, and clears the pending question (`ConversationViewModel.kt:101-117,153-157`). The Compose send button also erases the draft immediately, while the failed pending turn has no retry action (`ConversationScreen.kt:208-210,230-255`). | If generation succeeds but the follow-up history refresh fails, the answer disappears from the client and re-asking uses a new key/provider call. After a native timeout, retrying with the retained key requires manually retyping the exact question, so the claimed main mobile retry flow is not actually presented to the runner. | Keep the logical request ID/payload until the returned reply is rendered or transcript reconciliation succeeds; render the POST result directly or provide an explicit Retry action using the saved payload. Preserve pending state across configuration/process recreation where required by the mobile reliability target. |
| `19A-R07` | **P2** | **A locale-only goal edit leaves the active plan in the old language.** `updateCoachGoal()` stores `preferredLocale` (`service.ts:300-324`), while `planInputFingerprint()` omits it (`service.ts:1831-1848`). Yet that locale is used to localize the generated workout titles/instructions before they are persisted (`service.ts:1480,1802-1818`). | A runner who changes between English, French, and Arabic can save the preference successfully but keep a current week whose stored content remains in the previous language, undermining localization and RTL parity. | Include every persisted-plan presentation input—at least `preferredLocale`—in invalidation, or relocalize the active deterministic plan without another provider call. Review the result across EN/FR/AR and RTL before accepting parity. |

### Status of the findings this commit claims to remediate

| Prior finding | Static status at `19a58f3` |
|---|---|
| `B83-R01` | **Partial:** interaction and AI sleep parsing check current consent; Coach voice transcription does not (`19A-R01`). |
| `B83-R02` | **Implemented for the original planner/safety input scope:** the previously omitted load-ceiling inputs now invalidate the plan. Persisted-plan locale remains outside invalidation (`19A-R07`). |
| `B83-R03` | **Partial:** web/native send request IDs and retain them after request failure, but successful-POST/refetch failure and native retry presentation remain open (`19A-R06`). |
| `B83-R04` | **Partial:** domain writes are in one transaction, but the outer catch still reclassifies persistence failure as provider failure and no plan↔interaction relation exists (`19A-R02`). |
| `B83-R05` | **Partial:** mismatch detection and the premature FAILED→PENDING flip are fixed; exclusive retry claiming and stale-PENDING recovery are not (`19A-R03`). |
| `B83-R06` | **Partial/open:** actual insert counts are correct; slot-wide dismissal does not supply the required serialization invariant (`19A-R04`). |
| `B83-R07` | **Partial:** reconciliation exists, but its failure is swallowed with no durable retry/provenance (`19A-R05`). |
| `B83-R08` | **Implemented in code:** the context contract now documents `records` and `coachMemory`. Policy/runtime verification was not performed. |
| `B83-R09` | **Implemented in code:** `usedSignals` and the native follow-up focus affordance cross the v1/native contract. Kotlin compilation, rendering, TalkBack, RTL, and device behavior were not verified. |
| `B83-R10` | **Implemented in code:** web scrolling switches to `auto` under reduced-motion preference. Browser behavior was not verified. |

### Remediation of 19A-R findings (2026-08-03, on `feat/coach-tier0`)

Implementation evidence for §11's findings; same rule — no gate closes without the named tests.

- **19A-R01** — `transcribeCoachVoiceNote` now requires the current health-consent grant before
  the provider call (`403 CONSENT_REQUIRED`), completing the provider-boundary set (interaction,
  sleep parse, transcription).
- **19A-R02** — the outer catch rethrows `CoachError` unchanged, so `COACH_PERSISTENCE_FAILED`
  reaches the client as itself; the persistence-failure path now also records the SUCCESSFUL
  provider usage row (real tokens/cost, annotated) alongside the FAILED interaction; and
  `TrainingPlan.sourceInteractionId` (migration `20260803090000`) durably links an AI-assisted
  plan to the interaction that generated it.
- **19A-R03** — claiming is atomic: the insert's ON CONFLICT is conditional
  (`WHERE status='FAILED'`) on all three insert paths, zero affected rows → 409, so exactly one
  concurrent retry wins; `CoachInteraction.claimedAt` (same migration) is a processing lease and
  a PENDING row idle >10 min is conditionally reclaimed (`STALE_PENDING_RECLAIMED`) instead of
  stranding the key forever.
- **19A-R04** — writer and dismisser now serialize on the same per-slot
  `pg_advisory_xact_lock(hashtextextended(userId:kind:key))`; `dismissMemory` takes the lock
  then dismisses the whole slot in a transaction — both interleavings are now strictly ordered.
- **19A-R05 (partial)** — reconciliation is retried once with loud logging; the residual window
  (both attempts fail → stale until the next run save/delete) is documented in code, with the
  independently recomputed `records` context block as the live counterweight. A durable
  queue/dirty-marker (or read-time derivation) remains open.
- **19A-R06** — web clears the retained key only after the transcript refresh succeeds;
  native releases the key and pending bubble only once the reply is VISIBLE (reload success),
  keeps the pending question rendered otherwise, and the failed/unrefreshed pending turn now has
  a **Retry** button that re-sends the same question with the retained key. Process-death
  persistence of pending state remains open.
- **19A-R07** — `preferredLocale` added to `planInputFingerprint` (a locale-only edit rebuilds
  the deterministic week in the new language, free).

Validation: pure suites, eslint, coach-scope tsc, web parity 629+461, native parity 489 — green.
Kotlin uncompiled in this session. Open: T0-R03 TTS allowlist+private cache (decided: full fix,
queued next), T0-R07 DB integration suites, R05 durable repair, R06 process-death persistence.

### Static-review limitations for `19a58f3`

- No runtime or automated validation was performed, per request. PostgreSQL concurrency behavior,
  raw-SQL result counts, provider accounting, and failure recovery were assessed from source only.
- The approved Coach v2 screenshots remain the visual references, but this commit was not rendered.
  Theme, locale, RTL, keyboard/focus, large-text, screen-reader/TalkBack, and visual parity remain
  unverified.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

---

## 12. Static code review — commit `fa191d4`

### Review boundary and verdict

- **Reviewed commit:** `fa191d417a4625fe8e55ad6435da5c767fac66e8`
  (`fix(coach): remediate 19A-R01..R07 — transcription consent, honest persistence errors,
  atomic retry claiming, slot locks`).
- **Parent:** `19a58f3bc19a48b42e10b24e3865f8d4bf3c1c2b`.
- **Date:** 2026-08-03.
- **Method:** exact committed diff plus surrounding source, migration, client-flow, and approved
  Coach Conversation reference inspection only. No test, lint, typecheck, build, migration,
  database, browser, emulator, device, provider, or production command was run. The validation
  claims embedded in the commit were not re-run or independently accepted.
- **Verdict:** **changes requested.** Current-consent enforcement now covers transcription, the
  provider/persistence error categories are separated, conditional FAILED claims prevent two
  ordinary retries from reaching the provider, and the shared advisory slot lock is the right
  static shape for forget/write serialization. However, stale-lease recovery returns the wrong
  state, the normal web language switch still bypasses plan invalidation, and native post-run Retry
  is a dead action.
- **Release status:** this code-only review closes no release, privacy, security, migration,
  native-parity, or `SEC-*` gate. `EXECUTION_PLAN.md` remains the only status tracker.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `FA1-R01` | **P1** | **A successfully reclaimed stale request is immediately replayed from the stale in-memory `PENDING` row instead of being processed.** The code changes the database row from PENDING to FAILED and sets `interactionId` (`service.ts:1257-1275`), but the next branch still tests the unchanged `prior.status`; because it is still the string `PENDING`, `prior.status !== "FAILED"` is true and the function returns that runtime status with its null response (`service.ts:1276-1284`). Both interaction routes treat this as a successful 201 response; v1 shapes the null response to null (`api/v1/coach/interactions/route.ts:74-82`). | The first retry after the ten-minute lease does not reclaim/generate anything. Web/native can refresh a transcript that excludes the FAILED row, clear the retained key, and make the question disappear; a later ask uses a new key while the failed row still counts toward quota. The commit's stale-PENDING guarantee is not implemented. | After the conditional stale update wins, continue through the FAILED claim path using an updated local state or a dedicated branch; never return PENDING from this synchronous create operation. Verify fresh lease, stale lease, two simultaneous reclaimers, and the client response shape against a database before accepting `19A-R03`. |
| `FA1-R02` | **P1** | **The normal web Coach language selector still bypasses the new locale fingerprint.** The dashboard sends the lightweight `{ preferredLocale }` PATCH (`coach-dashboard.tsx:153-165`); the route dispatches that shape to `updateCoachGoalSettings()` (`api/coach/goals/[id]/route.ts:19-27`), which only updates the goal row (`service.ts:269-279`). `planInputFingerprint()` is evaluated only by the full `updateCoachGoal()` path (`service.ts:287-355,1903-1923`). | Switching the Coach from EN to FR/AR (or back) through the visible header control still leaves the active plan's persisted titles, instructions, and summary in the old language. `19A-R07` is fixed for full goal edits/native PATCH, but not for the primary web settings flow or RTL parity. | Route every locale mutation through one helper that updates the preference and rebuilds or relocalizes the active deterministic plan, without a provider charge. Accept only after the header selector is verified for EN→FR, FR→AR RTL, and AR→EN with the current week visible. |
| `FA1-R03` | **P2** | **The native Retry button is a no-op for failed post-run analysis.** `analyseRun()` deliberately leaves `pendingQuestion=null` and stores only `sendError` on failure (`ConversationViewModel.kt:142-155`). The screen renders `PendingTurn` whenever `sendError` is present and wires its Retry button to `viewModel.retry` (`ConversationScreen.kt:122-133,251-264`), but `retry()` immediately returns when `pendingQuestion` is null (`ConversationViewModel.kt:97-104`). A successful POST_RUN followed by reload failure is also silent: no pending question/error is retained (`ConversationViewModel.kt:149-151`). | The new recovery control visibly invites a tap but does nothing for the Analyze-run journey—the approved Conversation screen's main entry path. A refresh-only failure also gives no explanation, leaving the runner to infer that the separate Analyze card is the retry. | Store a typed pending operation (`CHAT` with message or `POST_RUN` with runId and retained requestId) and make Retry dispatch that exact operation. Show a distinct recoverable refresh state, keep one working action, and verify TalkBack/large-text/RTL focus and disabled states on both chat and post-run failures. |
| `FA1-R04` | **P2** | **A failed interaction can be regenerated against a different active goal while remaining linked to the old goal.** Idempotency matching compares only type/run/message (`service.ts:1247-1255`). A retry later loads the current active goal (`service.ts:1295-1300`), but the conditional upsert does not update or validate `goalId` (`service.ts:1412-1423`). Plan generation then writes the current goal plus the old interaction id (`service.ts:1857-1877`). The new `TrainingPlan.sourceInteractionId` is also only an unconstrained nullable text column—there is no Prisma relation, foreign key, or index (`schema.prisma:637-659`; migration `20260803090000`:1-2). | If a runner replaces/activates a goal after a failed ask and that request is retried, the interaction audit says Goal A while its response and linked plan were produced for Goal B. The new “durable link” can therefore preserve contradictory provenance and cannot enforce that the source interaction exists or belongs to the same runner/goal. | Bind a request id to the implicit goal/context identity and reject or explicitly restart when the active goal changed. Add the intended database relation/index (and same-runner/goal invariant where feasible), then verify failed INITIAL_PLAN/WEEKLY_REVIEW retries across goal replacement. |
| `FA1-R05` | **P2** | **This commit records roadmap/product decisions in the review evidence file instead of the designated sources of truth.** The document header explicitly says it is not a progress/priority/roadmap tracker (`coach_review_fable_codex.md:3-8`), but the commit adds decisions that change MVP scope and queued work—Ramadan deferral, permanent MFA handoff, delete-all semantics, and a queued TTS fix—and even says to mirror one into `EXECUTION_PLAN.md` (`coach_review_fable_codex.md:184-192,654-655`). Neither `EXECUTION_PLAN.md` nor `PRODUCT.md` contains those decisions in this commit. | Another device or reviewer following repository instructions still sees stale acceptance/priority text (for example `NATPAR-001` remains undecided), while the only current decision lives in a historical review. This recreates the competing-tracker problem the user and repository rules explicitly prohibited. | Put stable product decisions in `PRODUCT.md`; put priority, gate, owner, and open/closed status in `EXECUTION_PLAN.md`; update affected acceptance rows there in the same change. Keep this review file as dated evidence and links only, not the authoritative decision record. |

### Status of the findings this commit claims to remediate

| Prior finding | Static status at `fa191d4` |
|---|---|
| `19A-R01` | **Implemented in code:** transcription now checks the current consent grant before its quota read/provider call. Runtime/provider verification was not performed. |
| `19A-R02` | **Partial:** `CoachError` now escapes without provider reclassification and successful provider usage has a best-effort compensation write. The new plan-source field lacks relational integrity and can become cross-goal provenance (`FA1-R04`). |
| `19A-R03` | **Partial/open:** conditional FAILED claiming prevents the ordinary concurrent-retry double call, but stale-PENDING reclaim short-circuits on the old status (`FA1-R01`). |
| `19A-R04` | **Implemented in static code shape:** writer and dismisser take the same transaction advisory slot lock. Raw-SQL/PostgreSQL concurrency behavior was not executed. |
| `19A-R05` | **Still open by the commit's own description:** one immediate retry is not a durable repair path; two failures can still leave stale PB memory, and the prompt does not explicitly make the separate `records` block override conflicting SYSTEM_DERIVED memory. |
| `19A-R06` | **Partial:** web and native chat retain keys through transcript refresh, but native POST_RUN Retry is dead and process-death persistence remains open (`FA1-R03`). |
| `19A-R07` | **Partial/open:** full goal edits include locale in the fingerprint; the visible web language selector uses a separate non-invalidating settings helper (`FA1-R02`). |

### Static-review limitations for `fa191d4`

- The approved Coach Conversation v2 screenshot was inspected at original resolution as the relevant
  UI reference, but the changed recovery state has no approved screenshot and was not rendered.
- Theme, locale, RTL, keyboard/focus, large-text, screen-reader/TalkBack, Compose compilation,
  browser behavior, performance, and Capacitor/native side-by-side behavior remain unverified.
- Migration application/rollback, foreign-key behavior, raw-SQL affected-row semantics, advisory
  locks, leases, failure compensation, and provider accounting were reasoned about from code only.
- Concurrent uncommitted TTS/auth/Caddy/native-network work appeared during documentation; it was
  excluded from this exact-commit review and left untouched.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

---

## 13. Static code review — unreviewed commits after `fa191d4`

### Review boundary and verdict

- **Reviewed commit:** `dd64e00f7b4c7eeaad4213ea31a1b994ab78f1b8`
  (`feat(coach): TTS cue allowlist + private cache; signed-in web handoff (NATPAR-002)`).
- **Parent:** `fa191d417a4625fe8e55ad6435da5c767fac66e8`.
- **Date:** 2026-08-03.
- **Coverage:** this was the only commit reachable from the current `feat/coach-tier0` head after
  the last reviewed commit. The exact committed parent diff, surrounding auth/TTS/native source,
  Caddy/storage boundary, tracker/product references, native flow documents, and approved Account,
  Run Details, and Coach Overview screenshots were inspected. Concurrent uncommitted native-network
  and mobile-test work was excluded and left untouched.
- **Method:** static code and document inspection only, at the user's request. No test, lint,
  typecheck, build, migration, database, browser, emulator, device, provider, or production command
  was run. Validation claims in the commit message were not re-run or independently accepted.
- **Verdict:** **changes requested.** The cue allowlist is a meaningful restriction, the new cache
  prefix is denied by Caddy, the mint endpoint authenticates the live mobile session, the token
  claim remains atomic, and the intended native destinations are wired. The commit does not close
  either advertised boundary: legacy arbitrary-text audio remains under a public prefix, TTS quota
  reservation is still racy, and the browser handoff permits login CSRF through an unbound
  state-changing GET.
- **Release status:** this code-only review closes no release, security, privacy, cost, native-parity,
  or `SEC-*` gate. `EXECUTION_PLAN.md` remains the only progress/status tracker.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `DD6-R01` | **P1** | **Moving the TTS cache leaves the old arbitrary-text cache publicly served.** The parent wrote every synthesized file under `public/uploads/tts-audio` (`fa191d4:src/lib/coach/tts.ts:16-17,31`), when the endpoint still accepted arbitrary text. This commit changes future writes to `tts-cache` (`tts.ts:16-18,31-33`) and denies only `/uploads/tts-cache/*` (`Caddyfile:12-16`). The persistent uploads volume is not migrated or purged, and `/uploads/tts-audio/*` still falls through to the general public, immutable file server (`Caddyfile:25-45`). | Previously generated speech—including any user-supplied prose—remains anonymously downloadable after this “private cache” deployment. The SHA-256 filename is not authorization: it is deterministically derived from `locale::text`, so the requester who supplied/knows the text can derive the URL. `T0-R03` is not closed. | Deny both legacy and current TTS prefixes before the general uploads handler, inventory and securely purge/quarantine the legacy volume, and verify through the public proxy and direct-origin boundary that neither prefix is anonymously readable. Record the migration/rollback evidence in the real release tracker before claiming closure. |
| `DD6-R02` | **P1** | **The app-to-browser handoff is an unbound login-CSRF primitive.** The bearer endpoint mints a generic `NativeAuthToken` for only `viewer.id` (`web-handoff/route.ts:17-35`; `native-auth.ts:22-33`); the row carries no purpose, originating mobile-session id, destination, or browser challenge. Anyone holding the URL can make a browser `GET /auth/handoff`, which consumes the token and creates an ordinary cookie session as the token owner without showing or confirming the account (`auth/handoff/route.ts:14-35`; `native-auth.ts:82-116`). This is also authentication state mutation on GET, contrary to the repository's `SEC-005` “no state-changing GET” rule. | A malicious account can mint its own link and induce another runner to open it, silently replacing that browser's ZidRun identity with the attacker's for a normal web-session lifetime. The victim can then enter profile data, a payment proof, or security changes into an attacker-controlled account. Single use and five-minute expiry prevent replay; they do not prevent login CSRF/account confusion. | Use a dedicated, purpose-bound app→web credential tied to the live `MobileSession` and exact allowlisted destination; require an explicit account-confirmation/CSRF-protected POST before establishing the browser session (or an equivalent browser-bound challenge); re-check session revocation/security stamp at exchange; and log mint/consume outcomes without logging the secret. Accept only with adversarial cross-account, prefetch/link-scanner, reuse, expiry, destination, and revoked-session coverage. |
| `DD6-R03` | **P1** | **The advertised 60-call TTS ceiling is still a check-then-call race.** Every cache miss reads a usage count (`tts.ts:62-68`), calls the billed provider (`:70-80`), and inserts usage only afterward (`:81-88`). There is no atomic quota reservation or per-cache-key single-flight/lock. The new allowlist still permits many distinct numeric split/rep/step phrases (`tts-allowlist.ts:44-78`), and the route admits up to 90 requests per ten-minute process window (`tts/route.ts:20-23`). | Parallel allowed requests can all observe the same sub-limit count and reach the provider, exceeding the daily ceiling; parallel misses for one uncached phrase can also buy the same audio multiple times. The allowlist reduces content abuse but does not make the cost cap enforceable. | Reserve quota atomically before the provider call and let only one worker own a cache key (for example a durable PENDING usage/cache claim with a uniqueness invariant). Reconcile success/failure without losing billed usage, and verify parallel distinct-cue and same-cue misses against the database before closing the cost boundary. |
| `DD6-R04` | **P2** | **The authenticated TTS response is still explicitly shared-cacheable.** After session, entitlement, and allowlist checks, the route returns `Cache-Control: public, max-age=31536000, immutable` (`tts/route.ts:14-56`), while the new comments and review claim that the authenticated route is the only reader (`tts.ts:16-18`; this file `:283-289`). | A shared cache/CDN is permitted to reuse a cached response without re-running ZidRun's authentication/entitlement checks. The current Caddy configuration does not cache API responses, but the response contract itself contradicts the private-route boundary and can become an access bypass under a proxy/cache rule. | Either make the audio intentionally public and remove the entitlement/private-reader claim, or use a private cache policy and verify Cloudflare→Caddy→Next behavior, logout/account changes, and cache keys. Do not describe an authenticated-only route as public-cacheable. |
| `DD6-R05` | **P2** | **The generic fallback does not preserve login/destination behavior for GPX export.** `webHandoffUrl()` opens the plain `next` URL whenever minting fails (`AuthRepository.kt:83-92`). That works for protected account pages because middleware redirects them to login, but the newly wired GPX destination is an API route (`ZidRunApp.kt:419-423`); `/api/coach/runs/[id]/gpx` answers unauthenticated requests with a JSON 401 rather than a login redirect. | If token mint/refresh fails and the system browser has no existing cookie, Export GPX opens a raw “Login is required” API response, not the promised login flow with the export destination retained. The approved Run Details action therefore has a broken recovery path. | Give API-backed exports a purpose-built fallback: fetch the existing v1 GPX endpoint with bearer auth and deliver it through Android's cache/share sheet, or route through a web page that can authenticate then resume the download. Surface offline/session-expired errors in native UI and keep one working retry action. |
| `DD6-R06` | **P2** | **The commit again turns this evidence file into a progress/product tracker.** The header says the file is not a progress, priority, release, or roadmap authority (`coach_review_fable_codex.md:3-8`), yet this commit adds checked “closed in code” items for `T0-R03` and `NATPAR-002`, chooses the next work, and retains permanent MFA/Ramadan/delete-all decisions here (`:184-192,283-302`). Its exact diff does not update `PRODUCT.md` or `EXECUTION_PLAN.md`; those sources still describe `NATPAR-001/002` as open (`EXECUTION_PLAN.md:340-341`). | A second device or reviewer following repository instructions sees conflicting state, and the review itself overstates closure despite `DD6-R01`–`R05`. This repeats `FA1-R05` and the user's explicit instruction that this file must not track progress. | Put stable product decisions in `PRODUCT.md`; update finding/gate status, evidence, owner, and next priority only in `EXECUTION_PLAN.md`; keep this file as dated review evidence. Remove or clearly historicalize the operational checklists instead of advancing them here. |

### Static status of the commit's advertised work

| Claim | Static status at `dd64e00` |
|---|---|
| `T0-R03` cue restriction | **Implemented in code shape:** arbitrary prose is rejected before `synthesizeSpeech()`, and the regex families are bounded. Provider/runtime and complete generator-parity behavior were not executed. |
| `T0-R03` private cache | **Open:** the new prefix is blocked, but the persistent legacy arbitrary-text prefix remains public (`DD6-R01`) and the authenticated response remains shared-cacheable (`DD6-R04`). |
| `T0-R03` cost ceiling | **Open:** counting/logging exists, but quota and same-key cache ownership are not atomically reserved (`DD6-R03`). |
| `NATPAR-002` happy-path handoff | **Partial:** the static route/client wiring can mint and consume a one-time token, but the exchange has a login-CSRF/state-changing-GET design flaw and no commit-level adversarial coverage (`DD6-R02`). |
| Support, Security/MFA, and Coach Subscribe destinations | **Wired statically:** each now calls `openWebSignedIn()`. Custom Tab, cookie replacement, MFA, expiry, accessibility, locale, and device behavior were not run. |
| Run GPX export | **Partial:** the happy path targets the cookie-authenticated owner-scoped web export; handoff failure opens raw API 401 instead of a resumable login/export path (`DD6-R05`). Browser download/share behavior was not verified. |
| `FA1-R01`–`FA1-R04` | **Unchanged/open:** this commit does not touch stale interaction reclaim, the web locale settings path, native post-run Retry state, or cross-goal retry provenance. |
| `FA1-R05` | **Still open/repeated:** `DD6-R06` adds more status and priority claims to this review file without reconciling the designated sources of truth. |

### Static-review limitations for `dd64e00`

- The approved Account Overview, Run Details, and Coach Overview screenshots were inspected at
  original resolution. The commit changes destinations/session behavior rather than those rendered
  layouts; no Custom Tab, error, download, or authentication-transition state was rendered.
- No security test for the new handoff appears in the commit. Reuse, expiry, arbitrary-host,
  cross-account/login-CSRF, prefetch, revocation, and cookie-lifecycle behavior remain unverified.
- Caddy precedence, persistent-volume contents, shared caching, provider spend/accounting, and
  Android URI/Custom Tab/download behavior were reasoned about from source only.
- Theme, locale, Arabic RTL, keyboard/focus, large text, screen reader/TalkBack, reduced motion,
  browser behavior, Compose compilation, and physical-device parity remain unverified.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.


### 13.1 Remediation evidence for `DD6-R01`–`DD6-R06` (2026-08-03, Fable)

Dated evidence only. Status, gates, and next priority live in `EXECUTION_PLAN.md`; owner decisions
live in `PRODUCT.md` ("Product decisions — AI coach and native app").

- **`DD6-R01`** — `Caddyfile` now denies `/uploads/tts-audio/*` ahead of the general uploads
  handler, alongside the existing `tts-cache` deny; `scripts/purge-tts-audio-cache.ts` deletes the
  legacy directory (idempotent — a missing directory is success). Public-proxy verification of both
  prefixes remains a deploy-time check.
- **`DD6-R02`** — `NativeAuthToken` gained `purpose` (`WEBVIEW_BRIDGE`|`WEB_HANDOFF`),
  `destination`, and `mobileSessionFamilyId` (migration `20260803110000`, applied to the local DB).
  The mint (`POST /api/v1/auth/web-handoff`) binds all three server-side and returns a token-only
  URL. `GET /auth/handoff` is a pure peek (`peekWebHandoffToken`) rendering a masked-account +
  destination confirmation page (`no-store`, `no-referrer`); the session is established only by the
  same-origin POST (`Sec-Fetch-Site`/`Origin` checked), which re-verifies the minting
  `MobileSession` is unrevoked/unexpired before `signIn("native-bridge", …, purpose:
  "WEB_HANDOFF")`; `consumeNativeAuthToken` refuses a purpose mismatch. Mint/consume/reject are
  logged via `logSecurityEvent` (`web_handoff_minted`/`_consumed`/`_rejected`) without the secret.
  Adversarial coverage added to `test:mobile-api` (11 new checks, run against the local server +
  DB): token-only mint; purpose/destination/session binding in the row; peek renders without the
  full email and burns nothing across repeated GETs; cross-site POST refused with the token left
  unconsumed; same-origin POST sets a real `authjs.session-token` cookie and lands on the bound
  destination; replay refused; a `WEBVIEW_BRIDGE` token refused at the handoff door unconsumed; an
  expired token refused; a revoked mobile session kills its outstanding link unconsumed. Suite:
  81/81.
- **`DD6-R03`** — quota reservation is atomic: per-user `pg_advisory_xact_lock` + count + `PENDING`
  `AiUsageLog` insert in one transaction before the provider call (`AiRequestStatus` gained
  `PENDING` in the same migration), resolved to `SUCCEEDED`/`FAILED` after; same-phrase concurrent
  misses are single-flighted via an exclusive `.lock` file with 60s stale-lock reclaim; waiters
  poll the cache and delete (refund) their reservation on a hit; `report.ts` counts `PENDING` as
  in-flight, not failure. Parallel same-cue/distinct-cue DB verification remains open.
- **`DD6-R04`** — the TTS route now answers `Cache-Control: private, max-age=31536000, immutable`.
- **`DD6-R05`** — `webHandoffUrl()` mint-failure fallback is now
  `buildWebUrl("/login") + "?callbackUrl=" + Uri.encode(next)`, so an API destination (GPX export)
  recovers through login instead of a raw 401 JSON body. `:core:auth` compiles; full
  `assembleDebug lintDebug` passed this session (exit 0, 0 lint errors, 8 modules).
- **`DD6-R06`** — owner decisions moved to `PRODUCT.md`; `NATPAR-001` recorded closed-by-decision
  and `NATPAR-002` corrected in `EXECUTION_PLAN.md` with a new dated evidence row; §5's checklists
  and decision quotes are marked **HISTORICAL** (frozen 2026-08-03) rather than advanced.
- **Validation this session:** `test:mobile-api` 81/81 · `test:coach-mobile` 150/150 ·
  `test:coach` pure suites pass (planner 68/68, memory 42/42, context evals) · lint + web i18n
  parity + native parity (489 keys en/fr/ar) clean · `tsc` clean apart from the two pre-existing
  unrelated Capacitor/sentry items · native `assembleDebug lintDebug` exit 0.
