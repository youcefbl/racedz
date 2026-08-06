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

<!-- commit-review: a18e9b9db1f8921c6e2a5f21710dc4f65d8c13be -->

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

<!-- commit-review: b83a2391e25b8a9cac6d54dcb5f18ab601f67638 -->

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

<!-- commit-review: 19a58f3bc19a48b42e10b24e3865f8d4bf3c1c2b -->

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


## 11A. Static proposal review — Runs + Coach design pass (2026-08-04)

### Review boundary and verdict

- **Reviewed proposal:** the uncommitted `docs/native-design/current/2026-08-04/` device captures,
  `docs/native-design/proposals/2026-08-04/` diagnosis/recommendation/mockups, proposed
  `docs/native-design/UI_RULES.md`, and their proposed `AGENTS.md` / `EXECUTION_PLAN.md` wiring.
- **Code baseline:** `feat/coach-tier0` at `3b52d1e`; current Runs Compose screens, recorder state,
  mobile run DTO, and `/api/v1/runs/[id]` response were inspected to distinguish visual gaps from
  already-shipped behavior. The approved `docs/runs-design/RUNS_DESIGN_FLOW.md` and reference images
  remain the acceptance authority.
- **Verdict:** **Variant B is the best overview direction, but changes are requested before owner
  approval or Compose implementation.** The fold diagnosis, duplicated week cards, empty-state bug,
  plural defects, Coach counter ambiguity, and light-orange contrast complaint are well supported.
  The round-two live/detail mockups are not additive refinements: they remove approved/shipped
  behavior, present cadence series the product cannot collect, and are based on an incorrect claim
  that the build has no charts. Pending product choices are also made binding in repository policy
  before the recommendation's own approval asks have been answered.
- **Status:** review evidence only. This section does not approve a variant, make product decisions,
  or change progress/gate status; `EXECUTION_PLAN.md` remains the only tracker and `PRODUCT.md` the
  stable product/design-decision source.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `NDP-R01` | **P1** | **A pending proposal is already installed as binding policy.** `RECOMMENDATION.md:3,55-62` says the work is pending owner approval and asks the owner to choose the variant, numeral convention, empty-state direction, and Audiowide/Manrope policy. Nevertheless `UI_RULES.md:3-8,46-48,54-58,81-82` calls the redesign approved and hard-codes Variant B, Manrope, and Western digits; `AGENTS.md:10-16` then applies it to every native and web UI change. `EXECUTION_PLAN.md:362` likewise says the owner approved round two, while the adjacent row at `:363` says approval is pending. | Future agents can treat disputed product choices as settled, and a Runs-specific sticky-dock decision becomes a universal web/native law. The repository's sole tracker and its stable product authority disagree about what the owner decided. | Keep `UI_RULES.md` explicitly draft/proposed and do not wire it into `AGENTS.md` until the owner answers the four approval asks. Reconcile the two evidence rows. After approval, promote only the accepted general rules; scope the sticky dock to Runs unless a separate flow justifies it elsewhere, and record durable typography/numeral decisions in `PRODUCT.md`. |
| `NDP-R02` | **P1** | **The advertised full run-detail redesign removes the required pace profile and runner controls, while replacing them with invented cadence history.** The approved content order requires Pace plus Coach analysis, GPX export, privacy and Delete (`RUNS_DESIGN_FLOW.md:158-168`); current Compose renders the pace series and average line (`RunDetailScreen.kt:267-289`) and the export/analyse/privacy/delete surfaces (`:332-390` and below). The proposed full-scroll HTML ends after a cadence chart, insights, and three metrics (`src/run-detail.html:85-116`)—there is no pace chart or action/privacy/delete section. Its cadence array is a hard-coded mock (`:172-196`), while `RunDetailDto` has only scalar `avgCadence` and no cadence series (`Dtos.kt:411-437`), and the API returns splits, pace and elevation series only (`src/app/api/v1/runs/[id]/route.ts:24-35`). | Implementing the mockup literally would regress training analysis and privacy/data-control parity, while showing a graph that cannot be derived honestly from current data. It also contradicts the proposal's “richer” and “no data changes” claims. | Start from the existing detail screen, retain the pace chart and every existing action/privacy control, then refine splits/elevation styling. Remove the cadence chart until real timestamped cadence collection, storage, API, absence states, privacy, and performance rules are separately designed and approved. |
| `NDP-R03` | **P1** | **“The build lacks charts” is false and misdiagnoses the device evidence.** The proposal repeats that claim in `src/run-detail.html:7-11`, the contact sheet, and `EXECUTION_PLAN.md:362`. Current source already conditionally renders split bars, elevation and pace charts (`RunDetailScreen.kt:182-289`), and the API/DTO already deliver those series. The captured run-detail image proves only that the captured seeded run returned empty series, not that chart support is absent. | A Compose pass can duplicate existing code and leave the real empty-data/route-series problem unfixed; the sole evidence tracker currently records a fact the source disproves. | Inspect the captured run's API payload and route points, determine why the conditional series were empty, and describe round two as refinement of existing charts. Correct the contact sheet, source comment, and tracker evidence before approval. |
| `NDP-R04` | **P1** | **The proposed live screen drops the route map and invents live cadence.** The approved flow requires a map once a stable route exists (`RUNS_DESIGN_FLOW.md:96-122`) and the approved during-run reference includes it; current Compose conditionally shows the real route or GPS-acquiring state (`RecordingScreen.kt:316-338`). The proposed full viewport contains metrics, splits, and controls only (`src/run-live.html:64-100`). It displays cadence `172` (`:81-86`), but `RecordingState` has no cadence input or field (`RunRecorder.kt:12-28`); Android location fixes do not supply cadence. | Literal implementation loses spatial trust/recovery during a run and fabricates a health/performance metric. On the target low-end phone it also leaves unresolved how map, split strip, large text and thumb controls share the viewport. | Preserve the trusted-route map (or present an explicitly approved map/metrics toggle) and its acquiring/poor-GPS states. Omit cadence when unavailable; adding it requires an identified sensor/source and truthful unavailable behavior. Produce full-state layouts for acquiring, stable GPS, paused, auto-paused, and 1.3× text. |
| `NDP-R05` | **P1** | **The permanent Record dock has no active-recording state and can expose a destructive reset path.** The current overview detects Recording/Acquiring/Paused and offers Resume (`RunsOverviewScreen.kt:143-177`), but the proposed B dock is always `Record run` (`src/runs-b.html:122-127`). Navigating to Start and completing the hold calls `RunRecorder.start()`, which unconditionally clears the route and replaces the recording state (`RunRecorder.kt:184-197`). The existing below-fold Record control is already unsafe during an active run; pinning it makes that conflict permanently prominent. | A runner can mistake Record for the way back to the live run and overwrite an in-progress route. The proposal's central ergonomic improvement would amplify a data-loss path. | Make the dock stateful: Resume/Open recording for Recording, Acquiring and Paused; Save/Review for Finished pending data; Record only when Idle. Guard `RunRecorder.start()` against replacing non-idle state without an explicit discard confirmation, and design process-restored/pending/offline states before implementation. |
| `NDP-R06` | **P2** | **The proposed binding token table falsely says web and native are 1:1.** `UI_RULES.md:10-29` publishes the native dark values as universal and says `Color.kt` and `globals.css` are ported 1:1. `Color.kt:78-82` explicitly documents a deliberate native dark-palette divergence. For example native dark background/surface are `#0A0A0B`/`#151517` (`:83-94`), while web uses `#080D18`/`#101827` (`globals.css:35-47`). | Web work judged against this table can be incorrectly rejected or recolored, and contrast numbers computed for native cannot be claimed as web evidence. | Document semantic parity with platform-specific token tables and contrast calculations, or make the palettes genuinely identical through an explicit owner decision. Remove every 1:1 claim that is not true. |
| `NDP-R07` | **P2** | **The empty-state proposal contradicts Variant B's own invariant and quietly adds navigation scope.** UI Rules say Runs always uses the pinned dock (`UI_RULES.md:54-66`), but `src/runs-empty.html:43-89` has only the in-card “Record your first run” CTA and no dock. It also adds a chevron Coach promotion (`:69-78`), although `RECOMMENDATION.md:41-42` promises no navigation changes and supplies no destination, entitlement, offline, or disabled behavior. | The implementation brief is ambiguous about whether an empty account gets one or two primary actions, and a visual-only one-day estimate hides a new interactive/entitlement path. | Specify populated, empty, loading, error, offline and active-recording dock behavior with exactly one primary action. Either remove the Coach chevron or define its destination and entitlement/offline behavior and include that scope in the estimate. |
| `NDP-R08` | **P2** | **The artifacts do not yet pass the checklist they make mandatory.** `UI_RULES.md:130-142` requires light/dark/race × en/ar RTL × 1.3×, empty/loading/error/offline states and TalkBack labels for every change. Variant B has three themes and one Arabic render, but no French or 1.3× proposal render; the run live/detail and Coach refinements lack the stated locale/font/state matrix; mock HTML cannot prove TalkBack semantics. The normal-size B render already ellipsizes “TOTAL DISTANCE,” indicating the denser metrics row needs responsive treatment before large text. | Calling the pass complete or the checklist passed overstates the approval evidence, especially around accessibility and the device's bottom insets/navigation modes. | Separate mockup review from implementation/device acceptance. Before approval, add the affected French/RTL/1.3× and recovery/error states, including gesture and three-button navigation insets; keep TalkBack, focus order and semantics as implementation acceptance items rather than claims proven by PNGs. |
| `NDP-R09` | **P2** | **The proposed light-orange exception is not proven AA-safe.** `UI_RULES.md:35-38` permits `accentStrong` at “≥18sp semibold” because 3.55:1 is treated as large text. The large-text exception is size/weight dependent; an Android `sp` value is not itself proof that rendered text meets the applicable large-text threshold, and semibold is not automatically the required bold case. | A binding rule intended to prevent one contrast defect can authorize another 3.55:1 text failure. | Use a ≥4.5:1 text token for ordinary headings by default. If a 3:1 exception is retained, document the exact rendered size/weight threshold per platform and validate that concrete typography pair rather than granting a blanket `18sp semibold` exception. |

### What is ready to approve in principle

- The measured diagnosis is credible: the current source order places Record after both week cards,
  latest run, and personal bests (`RunsOverviewScreen.kt:230-269`), and the 8% zero-distance floor is
  explicit (`:278-289`). Merging the weekly facts is the right correction.
- Variant B is the strongest of A/B/C for the populated Runs overview because it keeps weekly
  momentum while restoring persistent thumb reach. Approval should be conditional on `NDP-R05` and
  on scoping the rule to this screen rather than every UI surface.
- The energized empty-state art direction, plural-resource correction, scoped Coach counters,
  reserved entitlement space, orange-icon treatment, one-series-per-chart rule, and reduced-motion
  hold specification are sound directions once the governance and data-contract issues above are
  reconciled.

### Static-review limitations

- No tests, build, lint, typecheck, browser render, emulator, device interaction, database query, or
  runtime/API call was run, per instruction. Existing PNGs were inspected at original resolution;
  device measurements and author-reported capture conditions were not independently reproduced.
- Only representative proposal/current captures were visually inspected; the 64-image matrix was
  counted and source/capture names were checked, not re-executed.
- The mandatory ZidRun app-review skill guided this review. The separately requested `impeccable`
  skill was unavailable; no `artifact-design` fallback skill was available in this session either.

### Remediation re-review — current uncommitted worktree (2026-08-04)

- **Boundary:** re-reviewed the revised proposal artifacts and the native Runs changes that appeared
  in the worktree during this review, still at committed baseline `3b52d1e`. The code boundary now
  includes `RunsOverviewScreen.kt`, `RunRecorder.kt`, `StartRunScreen.kt`, shell navigation,
  `ZidRunFormat.currentLocale()`, the new EN/FR/AR strings, and the unexecuted in-memory start-guard
  unit test.
- **Verdict:** **changes requested.** The revised detail/live artifacts now preserve the shipped
  charts, map and controls and no longer invent cadence; the in-memory start guard is also a real
  code fix. “All nine findings remediated” is nevertheless not supported. One process-death path
  can still replace an unsaved route, and Variant B plus two pending product choices are being
  implemented before the four approval asks are answered. The evidence/state matrix remains partial.
- **Status:** review evidence only. This subsection neither approves Variant B nor changes a release
  gate. `EXECUTION_PLAN.md` remains the only status tracker and `PRODUCT.md` the durable-decision
  authority.

#### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `NDP2-R01` | **P1** | **The new start guard protects only the current process; an interrupted route on disk can still be silently replaced.** `RunRecorder.snapshot()` persists active recordings with `finished=false`, but `restorePending()` returns only finished records (`RunRecorder.kt:135-160`). After process death `_state` is Idle, so the new guard at `:188-202` accepts a fresh recording. `RunOutbox` has one `pending-run.json`, and the next snapshot replaces it (`RunOutbox.kt:26-47`). The shell likewise restores only a finished pending run (`ZidRunApp.kt:232-236`). The new `RunRecorderStartGuardTest` covers Idle/Acquiring/Paused/Finished in memory only (`:27-77`); it does not attach or restore an outbox. | A killed/backgrounded run can exist on disk, appear as Idle/Record after restart, and be overwritten by the next run's first snapshot. The in-memory guard closes the originally demonstrated route reset but not the process-restored data-loss case required by `NDP-R05`. | Resolve any pending outbox record before exposing Record. Restore an interrupted record as an explicit salvage/save-or-discard state (or otherwise block `start()` while the outbox is occupied), and never replace the single pending file without an explicit resolution. Add focused `finished=false` process-restoration/overwrite coverage; no test was run in this review. |
| `NDP2-R02` | **P1** | **The proposal is now marked draft, but its unapproved choices are already implemented.** `UI_RULES.md:1-11` and `RECOMMENDATION.md:3,77-84` keep Variant B, the empty-state direction, Western Arabic digits and typography pending; `AGENTS.md:10-18` says token-accurate mockups must be owner-approved before Compose work. The worktree nevertheless identifies and implements Variant B and the energetic empty hero (`RunsOverviewScreen.kt:67-72,185-232,355-387`) and globally forces bare Arabic to `ar-DZ` for Western-number formatting (`Format.kt:117-126`). `EXECUTION_PLAN.md:362` still says no Compose code changed. | Pending product decisions have again become executable behavior without owner approval, and the numeral choice affects every native screen that calls `currentLocale()`, not only the Runs card. Review and tracker state no longer describe the worktree being reviewed. | Pause/revert the implementation until the owner answers the four asks, or obtain explicit approval and record durable numeral/typography choices in `PRODUCT.md` before proceeding. Then update the single tracker row to describe the actual implementation boundary and verification status. |
| `NDP2-R03` | **P2** | **The stateful dock disappears in loading, initial error and offline-empty states.** `RunsOverviewScreen.kt:104-118` returns the loading/error surfaces before entering the `else` branch that owns `RecordDock` (`:120-232`). That means a local Recording/Acquiring/Paused/Finished state loses its Runs-tab route back whenever the remote runs request is loading or fails. The draft checklist explicitly requires loading/error/offline states (`UI_RULES.md:158-173`), but no matching proposal frame exists. | The central “visible at every state” promise fails at exactly the time a network-independent recorder must remain reachable; a runner may see only a remote-data error while a local run continues. | Overlay the recorder-aware dock independently of the remote overview load state, or define an equivalent local-run action on every loading/error/offline surface. Add those states to the proposal/acceptance matrix. |
| `NDP2-R04` | **P2** | **The remediation evidence still contains mutually false claims.** `EXECUTION_PLAN.md:362` says the recorder clears unconditionally, all 1:1 claims are removed, labels wrap rather than truncate, and no Compose code changed; the current worktree contradicts the first and last claims. The superseded row at `:363` still describes absent charts, cadence and binding UI rules despite its correction prefix. `DIAGNOSIS.md:17-18` still says native tokens are ported 1:1 from web, even though the documented dark palettes deliberately diverge. The exact seeded capture payload/fixture is also absent, so the claimed no-`t`/no-`ele` cause is author-reported rather than reproducible from the checked-in artifacts. | The sole tracker and diagnosis remain unsafe pickup context: a future session can find both the disproven claim and its caveat, while the “all nine” closure statement hides partial items. | Consolidate the round-two/remediation evidence into one concise, current row; remove rather than preserve false details. Correct the diagnosis's 1:1 statement, describe the captured-route cause at its actual evidence level, and stop claiming all findings closed until the open rows below are satisfied. |
| `NDP2-R05` | **P2** | **`NDP-R08` remains partial: the added renders expose truncation and do not cover the changed state strings.** Shared mock CSS still forces one-line ellipsis (`src/tokens.css:115-120`); the 1.3x override changes `white-space` but leaves overflow/ellipsis and cannot wrap a single word (`src/runs-b-large.html:48-63`). At original resolution `runs-B-sticky-large-light.png` still clips the latest-run DISTANCE label, while the French render truncates “DISTANCE TOTALE” and “MEILLEURE ALLURE.” Native `DockButton` likewise forces every localized recording/resume/save label to one ellipsized line (`RunsOverviewScreen.kt:322-353`), while its storyboard is English/light only. No honest empty-series chart render or overview loading/error/offline render exists despite `RECOMMENDATION.md:37-58` and `UI_RULES.md:164-171`. | French, Arabic and large text can hide the state/action distinction in the new primary control, and approval evidence does not establish the proposal's own recovery or empty-data behavior. | Use a responsive metric/action layout that remains intelligible for the affected FR/AR/1.3x strings, then attach the changed dock states in those conditions. Add empty-series and overview loading/error/offline frames; keep TalkBack/focus/insets as implementation/device acceptance as already documented. |
| `NDP2-R06` | **P3** | **The revised empty-state HTML relies on browser error recovery.** `src/runs-empty.html:52-75` closes `.screen` before the dock and tab bar, then closes an unmatched `div` at `:90`; its removed CTA/promotion styles also remain dead at `:24-40`. | The PNG can look correct while no longer proving the intended screen-relative dock/container structure, making the mock source a misleading implementation reference. | Fix the element nesting so scroll content, dock and tab bar share one `.screen`, and remove the dead rules before using this artifact for approval. |

#### Remediation status by original finding

| Original finding | Static status after re-review |
|---|---|
| `NDP-R01` | **Reopened:** the documents say draft, but Variant B, the empty direction and Western digits are now in native code (`NDP2-R02`). |
| `NDP-R02` | **Addressed in the proposal:** pace and all shipped actions are restored; cadence history is removed. |
| `NDP-R03` | **Partial:** proposal/contact-sheet wording is corrected, but stale tracker text and the uncommitted captured-route evidence remain (`NDP2-R04`). |
| `NDP-R04` | **Addressed in the proposal:** the trusted-route map is restored, cadence is removed, and the requested live state board exists. |
| `NDP-R05` | **Partial:** stateful dock and in-memory `start()` guard are implemented; interrupted outbox data is still replaceable (`NDP2-R01`) and remote failure hides the dock (`NDP2-R03`). |
| `NDP-R06` | **Partial:** `UI_RULES.md` is correctly native-scoped, but the diagnosis and tracker still make a false 1:1/removal claim (`NDP2-R04`). |
| `NDP-R07` | **Addressed in the proposal/current patch:** the empty card has no second CTA or undefined Coach navigation. |
| `NDP-R08` | **Partial:** French and 1.3x captures were added, but clipping and required state coverage remain (`NDP2-R03`, `NDP2-R05`). |
| `NDP-R09` | **Addressed by static inspection:** the unsafe orange-text exception and revised light-theme orange labels are gone. |

#### Re-review limitations

- No tests, build, lint, typecheck, render command, emulator/device interaction, database query, or
  runtime/API call was run, per instruction. Findings are from the stable uncommitted diff, source,
  and original-resolution PNG inspection.
- The worktree changed concurrently during review. The boundary above reflects the settled native
  diff observed after the files stopped changing; unrelated dirty files were preserved.
- The mandatory ZidRun app-review skill guided this re-review. The referenced `impeccable` skill was
  still unavailable in this workspace.

---

## 12. Static code review — commit `fa191d4`

<!-- commit-review: fa191d417a4625fe8e55ad6435da5c767fac66e8 -->

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

<!-- commit-review: dd64e00f7b4c7eeaad4213ea31a1b994ab78f1b8 -->

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

---

## 14. Static code review — last two commits at `fd1c62b`

<!-- commit-review: fde3d793645e06b444c6a8f5f33faeb72d2d3c4d -->
<!-- commit-review: fd1c62b421cf861a5b7766c2ae688ad47634a6da -->

### Review boundary and verdict

- **Reviewed commits, oldest first:**
  1. `fde3d793645e06b444c6a8f5f33faeb72d2d3c4d`
     (`test(coach): governance integration cases + contract updates; overridable debug API base`).
  2. `fd1c62b421cf861a5b7766c2ae688ad47634a6da`
     (`fix(coach): DD6 remediation — handoff CSRF interstitial, TTS quota atomicity, legacy cache purge`).
- **Boundary:** exact committed diff from `dd64e00f7b4c7eeaad4213ea31a1b994ab78f1b8` through
  `fd1c62b421cf861a5b7766c2ae688ad47634a6da`, plus directly affected auth/session,
  deployment/storage, Coach/TTS, product/tracker, native-client, and test-contract source.
- **Method:** static code and document inspection only, as requested. No test, lint, typecheck,
  build, migration, database, browser, emulator, device, provider, or production command was run.
  Validation statements committed in §13.1 and `EXECUTION_PLAN.md` were read as author evidence,
  not independently reproduced or accepted.
- **Verdict:** **changes requested.** Purpose- and destination-bound handoff tokens, a read-only GET
  interstitial, private TTS response caching, the legacy Caddy deny, an atomic per-user TTS quota
  reservation, the GPX login fallback, and broader governance cases are meaningful improvements.
  However, the handoff can still mint a fresh browser session after a security-stamp invalidation,
  and the same-key TTS path can still issue duplicate paid provider calls. Five lower-severity
  deployment, product-source, UI/accessibility, and test-contract gaps also remain.
- **Release status:** this review closes no release, security, privacy, cost, native-parity, or
  `SEC-*` gate. `EXECUTION_PLAN.md` remains the only progress/status tracker; this section is dated
  review evidence only.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `FD1-R01` | **P1** | **A handoff minted before a password reset or MFA change can still establish a fresh browser session afterward.** The POST checks only that some `MobileSession` with the stored `familyId` is unrevoked/unexpired, selecting only its id (`src/app/auth/handoff/route.ts:58-69`); it does not bind that row back to the token's user or compare `MobileSession.securityStamp` with the live `User.securityStampAt`. `consumeNativeAuthToken()` then claims on only token id + `usedAt: null` after a separate read and never checks the mobile session, user block, or stamp (`src/lib/native-auth.ts:117-142`). MFA enrollment and password reset bump `User.securityStampAt` without revoking the session rows (`src/app/account/security/actions.ts:80-89`; `src/lib/password-reset.ts:74-86`). Finally, the new Credentials sign-in reaches the JWT callback with no old `token.securityStamp`; the callback treats that as not revoked and adopts the current stamp (`src/auth.ts:184-201`). There is also a check/consume window in which the mobile family can be revoked after line 61 but before line 74. The new contract cases cover revocation *before* POST but not a stamp bump or this race (`scripts/test-mobile-api.ts:851-875`). | A five-minute link minted before a password reset can sign the browser back in after the password was changed; one minted before MFA enrollment can create a post-enrollment session without the new second factor. This violates the repository's security-stamp revocation contract and the prior `DD6-R02` acceptance condition. | Validate and claim the handoff as one server-side operation: require matching token user + purpose + destination + unexpired/unspent state, a live unrevoked mobile family owned by that user, `MobileSession.securityStamp === User.securityStampAt`, and an unblocked user. Do not let the later JWT callback upgrade a stale credential to the current stamp. Add password-reset, MFA-enable, block/stamp-change, wrong-user-family, expiry-at-claim, and revoke-versus-consume race cases. |
| `FD1-R02` | **P1** | **The advertised same-key TTS single-flight still has an explicit duplicate-provider escape path.** A waiter polls for only about 25 seconds, tries the lock once more, and then continues even when `holdsLock` is still false (`src/lib/coach/tts.ts:84-102,161-178`). The owner may still be working: the OpenAI client is configured with a 20-second timeout and one retry (`:102`), while the pinned SDK defines that timeout per request and warns retries can make total wait much longer (`node_modules/openai/client.d.ts:78-104`). The source nevertheless assumes synthesis is at most 20 seconds (`tts.ts:139-140`). Pre-provider filesystem/lock failures also occur after the PENDING reservation but outside the resolving `try/finally` (`:69-104`), so such rows can consume the runner's quota for the full 24-hour count window. No parallel TTS case was added; §13.1 itself leaves same-cue/distinct-cue DB verification open. | A slow/retried synthesis can make two or more paid calls for the same cache key, exactly the cost race `DD6-R03` required single-flight to prevent. Operational errors can accumulate stuck reservations and deny otherwise eligible runners voice cues for up to a day. The distinct-cue daily ceiling is atomically reserved, but the same-key ownership and reservation lifecycle are not closed. | Use a durable cache-key claim/uniqueness invariant whose wait/lease covers the provider's complete retry budget; never call the provider without owning it. Give PENDING rows an explicit lease and deterministic stale reconciliation, and resolve/refund reservations on every exit. Verify parallel same-key success, slow retry, owner failure/takeover, process death, distinct-key quota saturation, and a request arriving at the quota edge while its same-key owner is in flight. |
| `FD1-R03` | **P2** | **The legacy-audio purge exists but is not part of deployment.** `scripts/purge-tts-audio-cache.ts` deletes the correct app-volume path when manually invoked (`:4-19`), but there is no package script, production start hook, Compose command, CI/release step, or operations instruction that invokes it. Production still runs only `prisma:deploy && start:docker` (`docker-compose.prod.yml:40-42`), while the committed evidence says the script “deletes the legacy volume directory on deploy” (`EXECUTION_PLAN.md:352`). | Reloading the new Caddy rule removes anonymous access, but arbitrary-text audio already retained on the persistent volume is not actually erased. `DD6-R01`'s purge/quarantine acceptance and the evidence statement are therefore only partially satisfied. | Wire the idempotent cleanup into the exact controlled deployment or document it as a mandatory one-shot release migration with failure/rollback handling. Record the resolved volume path, before/after inventory, Caddy reload, and anonymous public/direct-origin denial; do not claim “on deploy” until the deploy path invokes it. |
| `FD1-R04` | **P2** | **The move out of the review file leaves the designated sources of truth internally contradictory.** `PRODUCT.md` newly says native Android is the only mobile client and Capacitor is retired (`:65-66`), but its Users section still says the app ships as Android/Capacitor (`:12`). More importantly, `EXECUTION_PLAN.md` still locks Capacitor as the current release path and native as deferred/fallback (`:155-163,211-227`), including an open future switch decision, even though this commit adds native-only as an already made owner decision. The plan also remains “Last updated: 2026-08-02” (`:7`) despite the new 2026-08-03 statuses/evidence, and its evidence overstates both the deploy purge and “all six findings addressed” (`:352`). | A second device or reviewer cannot determine the actual mobile target, release path, parity obligation, or remaining DD6 work from the repository's sole tracker. `DD6-R06` is improved—this file is historicalized—but not fully remediated. | Reconcile the product introduction and every current plan/gate/decision affected by native-only, retire or rewrite the now-obsolete switch/fallback work, correct the DD6 evidence to partial where appropriate, and update the plan date in the same change. Keep this review section as immutable evidence rather than advancing status here. |
| `FD1-R05` | **P2** | **The new authentication interstitial is a hard-coded visual fork from ZidRun's approved auth system.** `confirmationPage()` emits raw HTML with `lang="fr"`, three languages mixed into single controls, fixed dark colors/system font, a raw internal path as “Destination,” no canonical ZidRun logo, no locale selection, no real RTL document mode, and a small unpadded 0.8rem “Not me” link (`src/app/auth/handoff/route.ts:103-137`). The approved native auth flow requires visible locale/theme support, shared three-mode tokens, natural single-locale French/Darija, true RTL, 1.3× font/TalkBack coverage, and canonical brand assets (`docs/native-design/NATIVE_APP_DESIGN_FLOW.md:55-63,105-140`). | The security confirmation is harder to understand and operate precisely where account identity must be unmistakable. It does not meet ZidRun's localization, theme, brand, touch-target, or accessibility contract, and it has no approved handoff-state reference. | Render the confirmation through the shared web design/i18n system (or a deliberately equivalent minimal component), resolve one locale and correct `lang`/`dir`, use a human destination label, canonical logo/tokens, visible focus and at least 44px actions, and verify light/dark/race plus EN/FR/Arabic RTL, large text, keyboard, and screen reader behavior. Add/approve a reference for this new auth state. |
| `FDE-R01` | **P2** | **The new governance suite does not pin several contracts it says it verifies.** The urgent route is unconditionally 201 in production (`src/app/api/coach/interactions/route.ts:36-40`), but the test accepts 200 or 201 (`scripts/test-coach-mobile.ts:667-682`); the consent boundary is explicitly a 403 `CONSENT_REQUIRED` (`src/lib/coach/service.ts:1330-1343`), but the test accepts 403 or 422 and merely searches the entire body for “consent” (`test-coach-mobile.ts:700-710`). It never re-counts provider usage after that no-consent request, and the urgent-without-consent assertion accepts any status below 500 (`:711-721`). The response privacy check is duplicated verbatim rather than covering another excluded field (`:605-611`). The handoff suite added in the next commit likewise omits the security-stamp invalidation exposed by `FD1-R01`, and no TTS concurrency case pins `FD1-R02`. | Regressions can pass with the wrong HTTP contract or an earlier validation failure, while committed “150/150”/“all six addressed” evidence appears stronger than the assertions. For health-consent and authentication/cost boundaries, permissive success criteria weaken the release evidence materially. | Assert exact status and stable error code (`201`, `403`, `CONSENT_REQUIRED`), verify the usage/provider boundary remains unchanged after no-consent traffic, assert the exact urgent response contract, replace the duplicate privacy assertion with a distinct excluded field, and add the missing stamp/revocation and TTS concurrency cases before treating the suites as closure evidence. |
| `FDE-R02` | **P3** | **The debug API-base override is interpolated into generated Kotlin without validation.** `-Pzidrun.debugApiBase` is inserted directly into a quoted `BuildConfig` literal and passed to Retrofit (`native-android/core/network/build.gradle.kts:21-29`; `ApiClient.kt:223-228`). A missing trailing slash is rejected by Retrofit at app startup, while a quote/backslash can make the generated source invalid. This is debug-only and cannot repoint a release build. | A common physical-device setup typo produces a late crash or opaque build failure instead of a clear configuration error, reducing the usefulness of the feature introduced by `fde3d79`. | Parse and validate an absolute `http`/`https` URI during Gradle configuration, require/normalize the trailing slash, escape the generated string safely, and fail with a targeted `zidrun.debugApiBase` message. |

### Static status of the advertised remediation

| Prior finding / claim | Static status after `fd1c62b` |
|---|---|
| `DD6-R01` legacy public TTS audio | **Partial:** Caddy now denies both TTS prefixes, but the promised persistent-volume purge is not invoked by deployment (`FD1-R03`). |
| `DD6-R02` browser handoff | **Partial:** GET is read-only; purpose, destination, expiry, reuse, basic mobile-family revocation, and same-origin POST are materially improved. Security-stamp invalidation/atomic revocation remains open (`FD1-R01`), and the confirmation UI is not product-ready (`FD1-R05`). |
| `DD6-R03` TTS cost concurrency | **Partial:** the per-user distinct-request ceiling is atomically reserved, but same-key ownership deliberately falls back to duplicate calls and reservation cleanup is incomplete (`FD1-R02`). |
| `DD6-R04` shared-cache response | **Implemented in static code shape:** the authenticated response is now `private, max-age=31536000, immutable`. Proxy/browser behavior was not run. |
| `DD6-R05` GPX handoff fallback | **Implemented in static code shape:** mint failure now opens login with the API destination preserved. Login/download/device behavior was not run. |
| `DD6-R06` review file as tracker | **Partial:** stable decisions and operational status were moved to the intended files and the old checklists were frozen, but those intended files now conflict and the tracker evidence/date is stale (`FD1-R04`). |
| `fde3d79` governance coverage | **Useful but not closure-grade:** safety, replay/mismatch, consent, memory ownership/dismiss/delete, material-plan replacement, and response-shape cases were added; permissive/duplicate assertions leave important contracts under-specified (`FDE-R01`). |
| Earlier `FA1-R01`–`FA1-R04` | **Unchanged by these two commits:** stale interaction reclaim, web locale invalidation, native post-run retry/process persistence, and cross-goal retry provenance were not modified here. |

### Static-review limitations

- The approved native Login screenshot was inspected at original resolution. The new handoff
  confirmation has no approved screenshot and was not rendered; Account/Run/Coach target screens
  were unchanged by these commits and retain the limitations recorded in §13.
- PostgreSQL advisory locks/transactions/enums, persistent-volume cleanup, Caddy precedence/reload,
  Auth.js cookie/JWT behavior, security-stamp races, OpenAI retries/billing, cache lockfiles, and
  Android Custom Tab/download behavior were reasoned about from source only.
- Theme, locale, Arabic RTL, large text, keyboard/focus, screen reader/TalkBack, browser cache,
  process-death, multi-instance, emulator/device, and production behavior remain unverified.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

### 14.1 Remediation evidence for `FD1-R01`–`R05`, `FDE-R01`–`R02` (2026-08-04, Fable)

Dated evidence only. Status lives in `EXECUTION_PLAN.md`; owner decisions live in `PRODUCT.md`.

- **`FD1-R01`** — `NativeAuthToken.securityStampAt` records the stamp in force at mint (migration
  `20260804090000`; nullable with no default and treated as INVALID, so a forgetful insert fails
  closed). `consumeNativeAuthToken()` is now one transaction: it claims by predicate
  (`token + purpose + usedAt NULL + not expired`), then requires an unblocked account, an unmoved
  stamp, and — for `WEB_HANDOFF` — a live unrevoked `MobileSession` **owned by the token's user**
  whose own `securityStamp` still matches. The claim is not rolled back on a failed check: a token
  presented under revoked credentials is burnt, not left spendable. The route's separate
  session pre-check was deleted rather than kept, since it was the check/consume window itself.
  New cases in `test:mobile-api`: stamp bump refused at both peek and POST (no session cookie),
  foreign device family refused, stamp-less token refused, plus the existing reuse/expiry/
  cross-origin/revocation set — 88/88.
- **`FD1-R02`** — the lockfile is replaced by a leased DB claim (`TtsCacheClaim`, migration
  `20260804100000`). The lease is derived from the provider's COMPLETE budget in the same file
  (`PROVIDER_TIMEOUT_MS × (PROVIDER_MAX_RETRIES + 1) + 30s`), the provider is never called without
  owning the claim, a waiter re-attempts the claim each tick so a failed owner is taken over on
  release, and a key that stays owned answers `503 TTS_BUSY` rather than duplicating a paid call.
  The `PENDING` reservation is resolved on every exit — SUCCEEDED/FAILED after a real call,
  refunded otherwise — so a filesystem or claim error can no longer strand a runner's quota.
  `npm run test:tts-claim` (new, 8/8) drives the real claim SQL: one winner under 8-way contention,
  no takeover of a live lease, takeover of an expired one, owner-scoped release.
  **Not covered: any actual provider call. "One paid call per key" is verified at the ownership
  invariant, not end to end.**
- **`FD1-R03`** — `tts:purge-legacy` added and invoked by the production start command
  (`prisma:deploy && tts:purge-legacy && start:docker`). The script reports `TTS_PURGE_OK` /
  `TTS_PURGE_FAILED` with a file/byte inventory and verifies removal rather than trusting
  `rm -f`; verified locally against seeded files. Deliberately non-blocking: the Caddy deny is the
  access boundary, and refusing to start the site over one undeletable file is disproportionate.
- **`FD1-R05`** — the hand-written HTML is gone. `/auth/handoff` is a real page rendering through
  the app layout, brand mark, theme tokens, ≥44px actions and the `en/fr/ar` dictionary, with a
  **human** destination label instead of a raw path; verified in all three locales
  (`dir="rtl"` and Darija copy for `ar`). The exchange moved to `POST /auth/handoff/confirm`, so a
  GET cannot become a state change even by accident.
- **`FDE-R01`** — assertions tightened to exact contracts (`201` + `BLOCKED` body; `403` +
  exactly `CONSENT_REQUIRED`; provider usage re-counted after a refused request; a genuinely
  distinct privacy field). **The tightened assertion immediately failed and exposed a real defect:**
  every v1 coach route mapped `CoachError` through an inline ternary that knew only 404/409/429, so
  a consent refusal reached the phone as `422 VALIDATION_FAILED` with nothing to route on. Fixed
  with a shared `coachErrorToApiError()`, new `CONSENT_REQUIRED` (403) and `SUBSCRIPTION_REQUIRED`
  (402) codes mirrored into the Kotlin `ApiErrorCode`, and a localized re-consent instruction in the
  native composer. `test:coach-mobile` 153/153.
- **`FDE-R02`** — `-Pzidrun.debugApiBase` is parsed and validated at Gradle configuration time:
  absolute `http(s)` only, host required, trailing slash normalized, quote/backslash/control
  characters refused. Verified against `not-a-url`, `ftp://x/`, and an embedded quote — each fails
  with a message naming the property.
- **`FD1-R04`** — `PRODUCT.md` no longer describes a Capacitor build; the locked release decision
  now states native-only and explicitly supersedes the old one; `NATIVE-008` is closed by owner
  decision; the P2 section is a delivery backlog, not an evaluation; the plan date is corrected; and
  the 2026-08-03 evidence row is marked partial where it overstated (the "deletes on deploy" claim
  was not true when written).
- **Validation:** `test:mobile-api` 88/88 · `test:coach-mobile` 153/153 · `test:tts-claim` 8/8 ·
  `test:coach` pure suites pass · lint + web i18n parity (641 UI + 461 coach) + native parity (490)
  clean · `tsc` clean apart from two pre-existing unrelated items · both migrations rehearsed on
  the local DB · native `assembleDebug lintDebug testDebugUnitTest` BUILD SUCCESSFUL.
- **Still unverified:** Custom Tab / browser-cookie behaviour of the new interstitial on a device
  (the phone was disconnected before this round), its light/dark/race × EN/FR/AR-RTL × large-text ×
  TalkBack matrix, an end-to-end paid TTS concurrency test, and production purge/Caddy-reload
  evidence.

---

## 15. Static code review — commit `f2343d4`

<!-- commit-review: f2343d437e2db85ff20e2d1f8db64ef9156b86c3 -->

### Review boundary and verdict

- **Reviewed commit:** `f2343d437e2db85ff20e2d1f8db64ef9156b86c3`
  (`fix(coach): FD1/FDE remediation — handoff stamp binding, durable TTS claim, typed consent
  errors`), relative to parent `fd1c62b421cf861a5b7766c2ae688ad47634a6da`.
- **Boundary:** the exact committed diff plus the directly affected auth/session invalidation,
  production-start/storage, Coach consent/navigation, web theme/i18n, native design-flow, and test
  contract source. Uncommitted voice/TTS work that appeared in the worktree during this review was
  deliberately excluded.
- **Method:** static code and document inspection only, as requested. No test, lint, typecheck,
  build, migration, database, browser, emulator, device, provider, or production command was run.
  The validation statements in §14.1 and `EXECUTION_PLAN.md` are author evidence, not independently
  reproduced results.
- **Verdict:** **changes requested.** The commit materially improves purpose/stamp binding, atomic
  token claiming, TTS ownership, typed mobile errors, the handoff UI, source-of-truth consistency,
  and governance assertions. It does not, however, serialize handoff consumption against a
  concurrent stamp/session invalidation, and the durable TTS work still permits duplicate paid calls
  and stranded quota under storage/process failure. Six lower-severity privacy, deployment,
  navigation, localization, configuration, and test-evidence gaps remain.
- **Release status:** this review closes no release, security, privacy, cost, native-parity, or
  `SEC-*` gate. `EXECUTION_PLAN.md` remains the only progress/status tracker; this section is dated
  review evidence only.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `F234-R01` | **P1** | **Handoff consumption is atomic for the token but not for the credential state it relies on.** `consumeNativeAuthToken()` claims `NativeAuthToken`, then reads `User.securityStampAt` and `MobileSession` inside an ordinary Prisma transaction (`src/lib/native-auth.ts:139-188`). Neither read locks the user/session row, and no serializable isolation is configured (`src/lib/db.ts:3-14`). A concurrent MFA/password/block stamp update or `revokeFamily()` can therefore commit after the matching row has been read but before the consume transaction/Auth.js sign-in finishes (`src/app/account/security/actions.ts:80-89,115-118`; `src/lib/api/v1/tokens.ts:240-252`). The comment that a concurrently revoked device “cannot slip through” is stronger than the actual database invariant. | A handoff can still establish a new browser session in the narrow revoke-or-stamp-change-versus-consume race that `FD1-R01` explicitly required closing. Completed invalidations are now rejected correctly; concurrent invalidation is not serialized. | Make token claim and credential validity one atomic database predicate/invariant, or lock the relevant `User` and `MobileSession` rows so invalidation cannot commit between validation and consume. Define ordering with the invalidation writers and add a real two-transaction revoke/stamp-change-versus-consume race case. |
| `F234-R02` | **P1** | **The DB claim still loses the one-paid-call invariant when cache publication fails, and the quota reservation is not crash-durable.** The owner marks usage successful, `writeCache()` writes directly to the final filename but swallows every mkdir/write failure, and the claim is then released (`src/lib/coach/tts.ts:114-145,156-163`). A waiter sees no complete cache, acquires the released key, and makes another paid call; because readers poll the final path during `writeFile`, they can also observe a partially published MP3 (`:218-224`). Separately, `AiUsageLog` PENDING rows have no lease or stale reconciliation: `finally` helps caught exits, but process death after reservation leaves the row counted for 24 hours, while `refundReservation()` itself suppresses cleanup failures (`:76-94,195-201`). The new `TtsCacheClaim` lease only recovers ownership, not that quota row. | Concurrent requests can become sequential duplicate provider charges during a volume fault, or receive corrupt/truncated audio. A killed worker can consume a runner's quota for the full rolling-day window even though its ownership lease is recoverable. Thus the prior P1 cost/reservation acceptance is improved but not closed. | Publish cache bytes atomically (temporary file + rename) and expose completion only after verified persistence; do not release a successful claim into immediate re-synthesis when publication failed. Give PENDING usage reservations a lease/reconciliation path that survives process death and cleanup outages. Exercise the production function under parallel success, write failure, partial-publication prevention, killed owner, and stale-reservation recovery—not only a copied claim statement. |
| `F234-R03` | **P2** | **Moving the handoff from a route response to a page drops its secret-specific referrer policy.** The parent response explicitly sent `Referrer-Policy: no-referrer` for the token-bearing URL (`fd1c62b:src/app/auth/handoff/route.ts:30-36`). The new page sets robots metadata but no referrer policy (`src/app/auth/handoff/page.tsx:11-16`), so the global `strict-origin-when-cross-origin` policy applies (`next.config.ts:12`). That policy sends the full URL, including `?token=...`, on same-origin requests. Rendering through the root layout adds scripts/styles and navigable header/footer surfaces, widening where that referrer can be recorded. | A five-minute sign-in credential can be copied into same-origin request/access/telemetry logs before it is consumed. Noindex prevents indexing; it does not control the `Referer` header. | Restore a route-specific `Referrer-Policy: no-referrer` header or equivalent page metadata and pin it in the handoff response contract. Keep the existing no-store/noindex checks separate. |
| `F234-R04` | **P2** | **`CONSENT_REQUIRED` is typed but the native client does not perform the promised re-consent route.** `ConversationScreen` receives only `onBack`, renders a localized inline error, and still shows the generic failed/Retry turn (`ConversationScreen.kt:71-75,126-133,177-182`). The app route supplies no callback to Coach Goal Setup (`native-android/app/.../ZidRunApp.kt:313-327`), despite the API/Kotlin comments saying the client “must route” there. Retrying chat repeats the same hard gate. For `analyseRun()`, `pendingQuestion` is deliberately null, so its displayed Retry calls `retry()`, which returns immediately when no pending question exists (`ConversationViewModel.kt:108-111,153-169`). | The stable code now reaches the phone, but a runner still cannot resolve it from the failure state; post-run consent refusal additionally exposes an inert Retry control. This falls short of the product's 403 + guidance hard-gate flow. | Give the consent state a localized, accessible “Review goal and consent” action wired to `coachSetup(editing = true)`. Suppress generic Retry for consent failures, and preserve a real retry action/type for POST_RUN after the runner returns. Add screen/ViewModel cases for chat and Analyze Run consent expiry. |
| `F234-R05` | **P2** | **The production purge fails open without the operator procedure its own comment promises.** `purge-tts-audio-cache.ts` logs `TTS_PURGE_FAILED` but neither throws nor sets a failing exit code when verification fails or `main()` rejects (`:49-72`); the Compose `&&` chain therefore starts the site (`docker-compose.prod.yml:42-45`). The script says `docs/OPERATIONS.md` requires grepping this marker (`:13-16`), but that document contains no TTS purge/marker instruction and was not changed in this commit. | A permissions or volume error can leave the legacy arbitrary-text audio indefinitely retained while deployment appears successful. Caddy still blocks anonymous access, so this is retention/operability rather than renewed public exposure, but the only failure signal is an unowned log line. | Either make the one-shot privacy migration fail the controlled deployment until removal is verified, or wire the marker to an explicit release check/alert with named owner, manual remediation, rollback, and before/after inventory in `docs/OPERATIONS.md`. Do not describe log inspection as required until the real procedure contains it. |
| `F234-R06` | **P2** | **The new handoff tests do not prove the two most important claims.** The “foreign device family” fixture creates the token for `otherUser` but stores the first user's `securityStampAt` (`scripts/test-mobile-api.ts:920-937`), so it is rejected by the earlier stamp comparison before device-family ownership is reached. The revocation case revokes before POST/peek, and no case overlaps revocation or a stamp bump with consumption (`:851-879`). `test-tts-claim.ts` copies the SQL into a separate helper and never calls `synthesizeSpeech()`, so it cannot observe reservation lifecycle, cache publication, or provider-call multiplicity (`:26-47,55-98`). | The reported 88/88 and 8/8 can stay green while `F234-R01` and `F234-R02` are present; the evidence overstates wrong-user ownership and end-to-end cost-race coverage. | Give the foreign token its own user's valid stamp so ownership is the only failing predicate; orchestrate real concurrent invalidation/consume transactions; and test the production TTS function with an injectable provider/cache boundary and call counter instead of only duplicating its claim SQL. |
| `F234-R07` | **P2** | **The handoff page supports three dictionaries, but the native handoff does not carry the app's selected locale and misclassifies its actual subscription destination.** `webHandoffUrl(next)` sends only `next` and builds the returned path without `lang` (`native-android/core/auth/.../AuthRepository.kt:83-99`), so middleware chooses the web cookie or browser `Accept-Language`, which can differ from the account/app locale. Also, native opens `/account/coach/subscribe` (`ZidRunApp.kt:245-248`), while `destinationLabel()` recognizes `/coach/subscribe` or the word `subscription`, so the confirmation says the generic “Your account” instead of “Coach subscription” (`src/app/auth/handoff/page.tsx:94-101`). | A Darija/French app can open an English confirmation, and a payment/subscription handoff does not accurately name where the security-sensitive action will land. The page was verified with manually supplied locales, not through the native flow that launches it. | Include the normalized app/account locale in the mint request or returned handoff URL and preserve it through fallback/confirm. Match destinations through a shared allowlisted destination-to-label map that includes `/account/coach/subscribe`; add native-to-page locale and label contract cases. |
| `F234-R08` | **P3** | **The debug API-base validation still admits values that fail later.** `resolveDebugApiBase()` checks scheme/host and normalizes a slash but does not reject an out-of-range port, user info, query, or fragment (`native-android/core/network/build.gradle.kts:66-88`). For example, Java `URI` can retain a numeric port outside the TCP range even though the later OkHttp/Retrofit base URL cannot use it. | This is debug-only, but some malformed physical-device overrides still pass Gradle configuration and surface as the late startup/build failure `FDE-R02` intended to eliminate; embedded credentials can also end up in generated `BuildConfig`. | Require no user info/query/fragment, validate the optional port as `1..65535`, normalize via a parsed URL rather than raw string concatenation, and cover these accepted-but-unusable shapes in configuration tests. |

### Static status of the advertised remediation

| Prior finding / claim | Static status after `f2343d4` |
|---|---|
| `FD1-R01` handoff stamp/session binding | **Partial:** completed stamp changes, blocked users, wrong purpose, and already-revoked/expired matching sessions fail closed; concurrent invalidation after the unlocked read remains possible (`F234-R01`). |
| `FD1-R02` durable TTS ownership/reservations | **Partial:** only an owner calls the provider during an intact-cache happy path, but failed/non-atomic publication can cause repeated paid calls and PENDING usage has no crash reconciliation (`F234-R02`). |
| `FD1-R03` deploy purge | **Partial:** production start now invokes the purge, but failure is success-exit/log-only and the referenced operations check does not exist (`F234-R05`). |
| `FD1-R04` source-of-truth reconciliation | **Implemented in the reviewed code/doc shape:** the current product and execution-plan native-only decision is internally consistent. This review does not validate completion evidence. |
| `FD1-R05` shared handoff UI | **Mostly implemented in static shape:** canonical mark, shared layout/theme remaps, three dictionaries, RTL subtree, human labels, visible focus, and 44px+ controls are present. Native locale propagation, the subscription label, and token-specific referrer protection remain open (`F234-R03`, `F234-R07`). |
| `FDE-R01` exact governance/typed consent | **Partial:** server status/code mapping and the tightened safety/consent assertions are materially better. Native resolution is not wired, and the handoff ownership assertion is a false positive (`F234-R04`, `F234-R06`). |
| `FDE-R02` debug API override validation | **Mostly implemented:** common scheme/host/string-literal failures now stop at configuration time; several parsed-but-unusable URL shapes remain (`F234-R08`). |
| Earlier `FA1-R01`–`FA1-R04` | **Not closed by this commit.** In particular, the existing POST_RUN retry defect is now also visible on the newly typed consent path (`F234-R04`). |

### Static-review limitations

- The approved native Login and Coach Conversation screenshots were inspected at original
  resolution. The handoff confirmation still has no approved screenshot and was not rendered.
- PostgreSQL isolation/locking, Auth.js cookie propagation, browser referrer behavior, cache-file
  publication, OpenAI retry/billing, persistent-volume cleanup, and Gradle/Retrofit parsing were
  reasoned about from committed source only.
- Light/dark/race, EN/FR/Arabic RTL, large text, reduced motion, keyboard/focus, TalkBack/screen
  reader, Custom Tab, process-death, multi-instance, production logs/alerts, and provider behavior
  remain unverified.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

---

## 16. Static code review — commit `e0093b6`

<!-- commit-review: e0093b653291f13e2388e8d8918e90e3f38de4e5 -->

### Review boundary and verdict

- **Reviewed commit:** `e0093b653291f13e2388e8d8918e90e3f38de4e5`
  (`feat(coach): COACHPAR-001 — voice notes and reply playback on native`), relative to parent
  `f2343d437e2db85ff20e2d1f8db64ef9156b86c3`.
- **Boundary:** the exact committed diff plus the directly affected native microphone/TTS lifecycle,
  Coach conversation contract, transcription/provider accounting, privacy inventory, approved Coach
  flow, and Android manifest. Uncommitted changes in `src/lib/native-auth.ts` and
  `scripts/test-mobile-api.ts` were unrelated and excluded.
- **Method:** static code and document inspection only, as requested. No test, lint, typecheck,
  build, migration, database, browser, emulator, device, provider, or production command was run.
  The `165/165`, Gradle, and parity results committed in `EXECUTION_PLAN.md` are author evidence,
  not independently reproduced results.
- **Verdict:** **changes requested.** The bearer transcription facade, paid-tier/consent checks,
  atomic quota admission, review-before-send intent, localized copy, app-private cache, and on-device
  TTS are sensible foundations. Three P1 privacy/safety defects remain: recording can continue after
  its stop control disappears, cancellation/process death can retain the health-adjacent audio file,
  and spoken playback omits the professional/safety notices shown on screen. Five P2 functional,
  accessibility, abuse-resistance, and accounting defects also remain.
- **Release status:** this review closes no release, privacy, safety, cost, accessibility, or
  native-parity gate. `COACHPAR-001` remains open under its existing device-acceptance condition.
  `EXECUTION_PLAN.md` remains the only progress/status tracker; this section is dated review evidence
  only.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `E009-R01` | **P1** | **A voice recording can continue after the UI removes its only stop control.** The text field and Send remain enabled while `state.recording` is true (`ConversationScreen.kt:277-363`), and `ConversationViewModel.send()` guards only an empty message or `generating`, not recording/transcribing (`ConversationViewModel.kt:126-132`). Sending an existing draft therefore sets `generating=true`; the entire mic/Stop control is then removed by `if (state.canUseVoice && !state.generating)` while `MediaRecorder` remains active (`ConversationScreen.kt:283-320`). There is no duration ceiling and no lifecycle observer that stops capture when the app backgrounds; only an explicit tap, `cancelRecording()`, or eventual ViewModel clearing closes it (`ConversationViewModel.kt:196-277`). The manifest nevertheless states there is “no background listening” (`AndroidManifest.xml:23-30`). | A runner can believe recording stopped because the stop affordance vanished while the app continues capturing ambient, health, or household speech throughout a Coach request (whose client timeout is intentionally long). Backgrounding the app has the same unbounded-capture risk. | Make recording, transcribing, and generating mutually exclusive in both UI and ViewModel; never remove or disable the visible Stop/Cancel action while the microphone is open. Stop/cancel on lifecycle background, navigation, send, logout, and entitlement loss; add a bounded duration and visible elapsed time. Pin send-during-recording, background/foreground, navigation, timeout, and entitlement-change cases with a recorder fake that proves `stop/release` occurs exactly once. |
| `E009-R02` | **P1** | **The “not retained” audio guarantee is not cancellation- or process-safe.** After `active.stop()`, deletion occurs only after the suspended network call and outside `finally` (`ConversationViewModel.kt:223-259`). If that coroutine is cancelled when the ViewModel is cleared, `active.discard(file)` is skipped; `onCleared()` calls `recorder.cancel()`, but `VoiceNoteRecorder.stop()` has already nulled its internal `output`, so `cancel()` no longer knows the finished file (`VoiceNoteRecorder.kt:57-84`). Process death leaves the same cache file, and there is no startup stale-file purge. `start()` also leaks its temp file and unreleased `MediaRecorder` if `prepare()`/`start()` throws before the fields are assigned (`:29-50`); a successful stop with a zero-length file returns null without deleting it (`:62-71`); every `delete()` result is ignored. This contradicts `docs/DATA_INVENTORY.md:56` and the committed evidence in `EXECUTION_PLAN.md:359`. | Arbitrary runner speech—including symptoms and injuries—can remain on disk indefinitely even though the privacy inventory says nothing is retained or exportable. Repeated failures can also accumulate cache files/resources. | Own the finished file independently of recorder state; wrap upload handling in cancellation-safe cleanup, and purge stale `coach-note-*` files at startup to cover process death. Release/delete on every `start` and `stop` failure, delete zero-byte results, handle deletion failure explicitly, and update the inventory/evidence until verified. Add cache-directory assertions for success, provider/API failure, coroutine cancellation, ViewModel clear, process restart, start/stop exceptions, and failed deletion. |
| `E009-R03` | **P1** | **“Read aloud” drops the reply's highest-level safety warnings.** `CoachReplyDto.spokenText()` says the professional-advice flag is included, but it concatenates only text collections and never adds localized text for `requiresProfessionalAdvice` (`Dtos.kt:485-522`). Playback is built from `message.response` alone (`ConversationScreen.kt:177-195`), so it also cannot include the separate notable `message.safety` notice rendered at `ConversationScreen.kt:474-479`. The visual card does show both professional advice (`:503-505`) and the deterministic safety notice, making the audio experience strictly less safe than the screen. | A runner using playback with the phone in a pocket can hear encouragement, warnings, and recovery advice but miss that the app recommends professional assessment or that the deterministic safety layer raised a notable verdict. This directly contradicts the evidence claim that a listening runner “must hear the caution.” | Compose spoken content at the message/UI layer so it can prepend/append localized professional-advice and notable-safety text as well as the structured reply. Test `requiresProfessionalAdvice`, each notable safety shape, ordinary warnings, CLEAR replies, and all three locales; playback must never omit a notice visible for that same message. |
| `E009-R04` | **P2** | **The new TTS feature is missing Android's package-visibility declaration.** The app targets SDK 36 (`native-android/app/build.gradle.kts:7-22`) and constructs `TextToSpeech` in `ReplySpeaker.kt:38-61`, but the manifest's `<queries>` contains only a browser VIEW intent (`AndroidManifest.xml:32-42`). [Android's `TextToSpeech` API documentation](https://developer.android.com/reference/android/speech/tts/TextToSpeech) says apps targeting Android 11+ that use TTS should declare an intent query for `android.intent.action.TTS_SERVICE`. In addition, `ReplySpeaker.speak()` sets the UI to Speaking before calling `tts.speak()` and ignores its immediate `ERROR` return (`ReplySpeaker.kt:79-87`). | Engine discovery/playback can be unavailable or inconsistent on Android 11+ even when a voice is installed, and an immediate enqueue failure can leave the control saying “Stop reading” without speech. | Add the `TTS_SERVICE` intent to `<queries>`, treat the return value of `speak()` as authoritative, and return the UI to an actionable unavailable state on `ERROR`. Verify default and alternative engines, missing-language data, no TTS engine, initialization/enqueue failure, and Android 11+ package visibility on a device. |
| `E009-R05` | **P2** | **One current goal language is incorrectly applied to every historical reply.** `GET /api/v1/coach/interactions` fetches the latest active goal's current `preferredLocale` and returns one conversation-level `replyLanguage` (`src/app/api/v1/coach/interactions/route.ts:30-60`). Every message is spoken with that one locale (`ConversationScreen.kt:177-195`). Goal editing mutates `preferredLocale` in place (`src/lib/coach/service.ts:269-279,287-324`), while `CoachInteraction` persists no response locale (`prisma/schema.prisma:847-885`). Replies from earlier goals are also returned in the same history. | After changing Coach language—or when history spans goals—old French/Arabic/English replies are read with the new goal's voice, producing the mispronunciation the commit says `replyLanguage` prevents. The new test asserts only one English current-goal happy path (`scripts/test-coach-mobile.ts:819-822`). | Persist the response locale with each interaction and return it per `CoachMessageDto`; choose the voice per message. Define a safe legacy-row fallback that avoids confidently using a known-wrong voice. Cover language edits, histories spanning goals, pagination, and en/fr/ar message mixtures. |
| `E009-R06` | **P2** | **Several advertised voice states are unreachable or incomplete.** A provider-empty transcript becomes a 422 `EMPTY_TRANSCRIPT` `CoachError`, but `coachErrorToApiError()` maps 422 to `VALIDATION_FAILED` (`src/app/api/v1/coach/transcribe/route.ts:66-73`; `src/lib/api/v1/coach.ts:78-104`); the ViewModel maps every non-consent/subscription failure to `VoiceError.Failed` (`ConversationViewModel.kt:235-253`). `VoiceError.Empty` is therefore reachable only from a successful empty response that the route explicitly prevents. While transcribing, the spinner remains an enabled IconButton labelled “Record”; tapping it silently no-ops because `startRecording()` refuses transcribing (`ConversationScreen.kt:286-320`; `ConversationViewModel.kt:204-205`). Recording/transcribing feedback is plain `Text` without live-region semantics and has no elapsed time (`ConversationScreen.kt:260-269`), contrary to the approved flow's elapsed/status and announced-live-state requirements (`COACH_DESIGN_FLOW.md:200-214,265-267`). The localized `coach_voice_review` instruction is present in all locales but unused. | “Nothing heard” shows the generic failure, TalkBack may not announce microphone state changes, the busy mic is a dead control, and runners are not explicitly reminded to review the inserted transcript. The existing device acceptance matrix cannot pass as implemented. | Give empty transcript a stable mobile error code and map it to `VoiceError.Empty`; disable or replace the mic during transcription with truthful semantics; expose elapsed recording time and an announced polite status; show the localized review instruction after insertion. Add reducer/Compose semantics cases for every advertised state and transition in en/fr/ar/RTL. |
| `E009-R07` | **P2** | **The 10 MB and audio-only boundaries are enforced only after the multipart body is parsed.** The route calls `await request.formData()` before inspecting `audio.size`, and accepts an empty MIME type because the allow-list check is conditional on `audio.type` being truthy (`src/app/api/v1/coach/transcribe/route.ts:45-66`). No repository proxy or multipart-route body cap was found (the existing bounded reader covers JSON only: `src/lib/api/v1/http.ts:149-168`). The new tests construct an 11 MB `FormData` object and prove only post-parse refusal (`scripts/test-coach-mobile.ts:793-805`). | An authenticated/compromised paid account can make the server consume an arbitrarily large multipart upload before the advertised cap runs, causing avoidable memory/temp-storage and request-worker pressure. Empty-type arbitrary bytes can also reach a billed provider attempt. The process-local burst limiter does not bound bytes or coordinate instances. | Enforce a hard request-body limit before/full-stream parsing at the proxy or streaming multipart boundary (including chunked requests), require a non-empty allowlisted media type, and add container/signature validation where practical. Test over-limit and chunked bodies without materializing them in the application, missing MIME, spoofed MIME, and multi-instance rate behavior; confirm no usage reservation/provider call occurs. |
| `E009-R08` | **P2** | **The transcription quota reservation has no crash lease or stale reconciliation.** The advisory lock correctly serializes count + PENDING insert, but the rolling count includes every status and the row is resolved only after the provider promise returns (`src/lib/coach/service.ts:361-428`). Process death after line 409 leaves PENDING counted for 24 hours; a DB failure while marking success can turn a completed paid transcription into an error and can itself prevent the catch update. Unlike `CoachInteraction.claimedAt` or `TtsCacheClaim`, the new transcription reservation has no ownership lease/recovery path. The added suite deliberately exercises only pre-provider refusals (`scripts/test-coach-mobile.ts:772-817`). | Crashed workers or accounting outages can consume subscriber voice quota without returning text, while logs can misclassify or strand a provider call. Atomic admission prevents overshoot but does not make the reservation lifecycle durable. | Add a lease/attempt identity and deterministic stale-PENDING reconciliation; make terminal accounting idempotent and distinguish provider success from later bookkeeping failure. Test killed owners before/during/after provider success, stale recovery, terminal-update failure, concurrent limit saturation, and exactly-once usage classification with an injectable provider. |

### Static status of the advertised feature

| Advertised area | Static status after `e0093b6` |
|---|---|
| Paid bearer transcription facade | **Partial:** authentication, entitlement, consent, quota admission, and review-before-send shape are present; pre-parse byte limiting, MIME strictness, empty-result typing, and crash-durable accounting remain open (`E009-R06`–`R08`). |
| Native voice recording | **Changes required:** the basic AAC/cache/upload path exists, but capture control is not lifecycle-safe and local deletion is not guaranteed (`E009-R01`, `E009-R02`). |
| Reply playback | **Partial and safety-incomplete:** on-device TTS avoids sending arbitrary reply text to another provider, but safety notices are omitted, manifest visibility is missing, and engine errors are incomplete (`E009-R03`, `E009-R04`). |
| Reply language | **Incorrect for history:** one mutable current-goal locale is applied to every message (`E009-R05`). |
| Localization/accessibility | **Partial:** strings and control descriptions exist in en/fr/ar, but live-state announcement, elapsed time, truthful busy controls, and transcript-review feedback are incomplete (`E009-R06`). |
| Advertised verification | **Not closure-grade for this feature:** the committed server suite covers refusal paths and one English locale field only; it explicitly contains no successful transcription. No focused native test for recorder cleanup, ViewModel cancellation/state transitions, `spokenText()`, TTS errors, or historical message locales was added. Device/TalkBack/cache verification remains open in the tracker. |

### Static-review limitations

- The approved Coach Conversation screenshot was inspected at original resolution. It specifies the
  composer/mic placement but not the new recording, transcribing, permission, or playback error
  states; those were checked against `docs/coach-design/COACH_DESIGN_FLOW.md` and the existing web
  voice flow instead.
- Android microphone/background behavior, cache deletion, lifecycle cancellation, TTS package
  visibility/engine behavior, multipart buffering, PostgreSQL advisory locking, OpenAI retries and
  billing, process death, multi-instance deployment, and provider output were reasoned about from
  source only.
- Light/dark/race, EN/FR/Arabic RTL, font scaling, TalkBack/live announcements, permission denial,
  app backgrounding, no-engine/no-language devices, offline/slow upload, and physical-device behavior
  remain unverified.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

### 15.1 Remediation evidence for `F234-R01`–`R08` (2026-08-04, Fable)

Dated evidence only. Status lives in `EXECUTION_PLAN.md`; owner decisions in `PRODUCT.md`.

**Two real defects were found by taking R06 seriously — both invisible to the previous suites.**

1. **The advisory locks never worked.** `pg_advisory_xact_lock` returns `void`, which `$queryRaw`
   cannot deserialize: both the TTS and transcription quota reservations threw `P2010` at runtime
   instead of taking a lock. `memory-store.ts` used `$executeRaw` and worked; the two paths added in
   the DD6/FD1 rounds did not, and nothing executed them because `synthesizeSpeech()` needs a
   provider key. Both now use `$executeRaw`. The "atomic reservation" reported as evidence in §13.1
   and §14.1 **was not functioning** on either path until this commit.
2. **The claim was held after a provider failure**, not only after a failed publication, so a failed
   synthesis wedged the phrase for its lease and the next runner waited it out for someone else's
   error. Now held only when audio was paid for but could not be published.

- **`F234-R01`** — the consume transaction now takes `FOR UPDATE` on the `User` row and on the
  matching `MobileSession` row, so an invalidation cannot commit between validation and consume;
  every invalidation writer touches those rows, so they queue behind each other. **The new race case
  was verified to actually detect the defect:** with the lock removed it FAILS (a real
  `authjs.session-token` is issued); with it, refused. An earlier version of that case passed
  without the lock — its token was already dead from a previous test's revocation, and it awaited
  the in-flight request inside the holding transaction, deadlocking and rolling the invalidation
  back. Both flaws are fixed and noted in the test.
- **`F234-R02`** — audio is published temp-file + `rename` (atomic within the directory), so a
  waiter can never read a partial MP3; the claim is released unless publication failed;
  `AiUsageLog` PENDING rows have a lease and are reconciled to `RESERVATION_ABANDONED` on the next
  attempt instead of consuming quota for 24 hours after a process death. Same lease applied to
  transcription.
- **`F234-R06`** — `synthesizeSpeech()` takes an injectable synthesizer **only** so tests can drive
  the production function; `test:tts-claim` (13/13) now counts provider calls through it rather than
  re-running copied SQL: one call under 6-way contention, identical bytes to every caller, no
  `.part` file left, cached second call costs nothing, one billed row, nothing left PENDING, stale
  reservation reconciled, provider failure recorded and the key immediately retryable. The
  foreign-device-family case now carries its own user's valid stamp, so ownership is the only
  predicate that can reject it (it previously failed one check earlier — a false positive).
- **`F234-R03`** — `/auth/handoff/:path*` is served `Referrer-Policy: no-referrer` (and `no-store`);
  verified live and pinned by a contract case.
- **`F234-R04`** — the consent state now offers "Review goal and consent" wired to
  `coachSetup(editing = true)`; Retry is suppressed when it cannot change the outcome; and
  `retry()` handles a POST_RUN analysis, whose Retry button previously did nothing at all because
  `pendingQuestion` is deliberately null for it.
- **`F234-R05`** — `docs/OPERATIONS.md` gains "Required post-deploy check — legacy TTS audio purge":
  the grep, both success markers, the before/after inventory to record, owner remediation for
  `TTS_PURGE_FAILED` (including direct volume removal and a `curl -I` 403 confirmation), the rule
  that a MISSING marker counts as failure, and the note that the purge is not reversible. The
  script's comment no longer references a procedure that does not exist.
- **`F234-R07`** — the mint accepts the app's locale and returns it in the link; the native client
  sends `LocaleManager.currentTag()` and carries it into the login fallback too; destinations resolve
  through one shared ordered map that includes `/account/coach/subscribe`. Pinned: `lang=ar` in the
  minted path, `dir="rtl"` rendered, and the subscribe destination named in Arabic rather than the
  generic account label.
- **`F234-R08`** — user info, query, fragment, and out-of-range ports are refused at Gradle
  configuration time; verified against four such values.
- **Validation:** `test:mobile-api` 94/94 · `test:coach-mobile` 165/165 · `test:tts-claim` 13/13 ·
  pure coach suites pass · lint + web parity (641+461) + native parity (506) clean · `tsc` clean
  apart from two pre-existing unrelated items · native `assembleDebug lintDebug testDebugUnitTest`
  BUILD SUCCESSFUL.
- **Still unverified:** no device run this round (the phone was disconnected); the confirmation
  page's theme/large-text/TalkBack matrix; a real provider call anywhere; production purge and
  Caddy-reload evidence.

## 17. Retrospective static code review — commit `e586def`

<!-- commit-review: e586defbab34b73d4fe15f3b6570a0eda641fed0 -->

### Review boundary and verdict

- **Reviewed commit:** `e586defbab34b73d4fe15f3b6570a0eda641fed0` against parent
  `b83a2391e25b8a9cac6d54dcb5f18ab601f67638`.
- **Reason for retrospective review:** this commit previously appeared only as remediation evidence
  inside §10. It did not have its own findings-first commit review, so it was the one uncovered code
  commit in the requested `a18e9b9..HEAD` history.
- **Scope:** native Coach memory/privacy UI and API, remote Runs/Coach flags, and the Runs control
  cleanup. The approved Coach Overview image and the Coach design flow were used where applicable;
  there is no approved standalone memory screenshot.
- **Verdict:** **changes requested.** The commit adds a useful, entitlement-independent memory
  surface and removes controls for features that did not exist. Three P2 gaps keep the advertised
  memory parity and “real kill switch” claims partial. These paths are unchanged at current head.
- **Release status:** dated review evidence only. This section changes no progress or gate status;
  `EXECUTION_PLAN.md` remains the only tracker.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `E586-R01` | **P2** | **The native memory surface omits the promised export control even though its new API implements export.** `GET /api/v1/coach/memory?export=1` returns the full raw memory set with provenance and timestamps (`e586def:src/app/api/v1/coach/memory/route.ts:14-44`), but `CoachRepository` exposes only list, per-item action, and delete-all calls, and `CoachMemoryScreen` renders only confirm, forget, and delete-all (`e586def:native-android/core/auth/.../Repositories.kt:281-304`; `CoachMemoryScreen.kt:118-172`). The approved flow requires runners to “confirm, forget one item, export, or delete all memory” (`docs/coach-design/COACH_DESIGN_FLOW.md:184-187`). | A native-only runner can inspect and erase memory but cannot exercise the data-access/export path the surface and parity item promise. The server capability is effectively unreachable from the native product. | Add a localized Export action backed by the existing authenticated endpoint, define a safe Android destination/share flow and failure state, and verify the exported artifact contains the full scoped data without exposing it to other apps by default. |
| `E586-R02` | **P2** | **The remote flags hide bottom-bar buttons once per process; they do not behave as an operational kill switch.** Config is fetched only by `LaunchedEffect(Unit)` and fails open while null (`e586def:native-android/app/.../ZidRunApp.kt:97-103`). `AppShell` always registers the Runs and Coach destinations and filters only the bottom-bar list (`e586def:native-android/app/.../ui/shell/AppShell.kt:136-181,210-236`). A runner can enter a tab during the fail-open first frame; when a false flag arrives, the selected destination stays rendered with its selected tab removed. A server-side flag change is also invisible until the app process is recreated, and the feature APIs remain callable. | During an incident, an operator cannot reliably remove an already-open or long-lived misbehaving feature “without a new binary,” despite the code and evidence describing that behavior. It is navigation visibility, not a complete disable boundary. | Model flags as live shell state: gate destination entry and feature actions, redirect an active disabled destination to a safe tab, and refresh config on foreground/session refresh with bounded caching. Define whether the server must also refuse disabled feature APIs, then verify true→false while the app is open, cold/offline launch, stale config, and direct/deferred navigation. |
| `E586-R03` | **P2** | **Memory mutations expose untranslated server text and busy rows remain enabled to accessibility services.** Mutation failures copy `result.error.message` directly into UI state and render it verbatim (`e586def:.../CoachMemoryViewModel.kt:58-90`; `CoachMemoryScreen.kt:109`), so French/Arabic users can receive English backend sentences. `ZidRunTextButton` has no enabled state; while another action is active, every other Confirm/Forget button keeps its normal label and enabled semantics but silently ignores taps through `if (!anyBusy)` (`CoachMemoryScreen.kt:180-220`). | Errors break the three-locale contract, while TalkBack and sighted users encounter controls that announce and look actionable but do nothing. Repeated taps have no truthful progress or disabled feedback. | Map stable API error codes to localized strings, retain a generic localized fallback, and give the shared text button a real disabled/loading semantic state. Disable all conflicting actions visibly and accessibly while a mutation is pending; verify en/fr/ar/RTL and TalkBack focus/announcement behavior. |

### Static-review limitations

- No tests, build, lint, typecheck, emulator, device, network/provider, or runtime feature-flag
  exercise was performed, per instruction. Findings are from the exact committed diff and current
  source only.
- The standalone memory surface has no approved screenshot; hierarchy and interaction states were
  checked against the written Coach design flow and repository UI rules.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

## 18. Static code review — commits `09ad87f` and `cffa228`

<!-- commit-review: 09ad87f528f7e1afb5e91f2e2d5d8f13088721f1 -->
<!-- commit-review: cffa228258f57667a6c2f0e0783fdda948827681 -->

### Review boundary and verdict

- **Reviewed range:** `09ad87f528f7e1afb5e91f2e2d5d8f13088721f1` and
  `cffa228258f57667a6c2f0e0783fdda948827681`, against parent
  `e0093b653291f13e2388e8d8918e90e3f38de4e5`.
- **Scope:** F234 remediation code/evidence and the follow-up `EXECUTION_PLAN.md` evidence row. The
  unchanged COACHPAR-001 findings in §16 were not re-attributed to these commits.
- **Verdict:** **changes requested.** The commits improve row locking, atomic cache publication,
  quota recovery, native consent guidance, handoff privacy/localization, operations documentation,
  and production-path testability. The security lock still ends before browser-session issuance,
  re-consent destroys the pending failed turn, and a post-provider bookkeeping failure remains
  classified as provider failure. The follow-up tracker row therefore overstates full closure.
- **Release status:** no release, security, privacy, cost, native-parity, or `SEC-*` gate closes from
  this static review. `EXECUTION_PLAN.md` remains the only status tracker.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `09AD-R01` | **P1** | **`FOR UPDATE` protects token validation, not the browser session that validation authorizes.** `consumeNativeAuthToken()` locks `User`/`MobileSession`, validates, returns a user, and commits at the end of its Prisma transaction (`src/lib/native-auth.ts:135-205`). Auth.js then continues through the native-bridge provider and JWT callback outside that transaction (`src/auth.ts:85-107,151-205`). A fresh bridge JWT has no `token.securityStamp`; if an invalidation commits after consume releases its locks but before JWT/cookie issuance, the callback sets `revoked=false` because the old stamp is absent and adopts the new live stamp (`src/auth.ts:189-201`). The new race case covers only the opposite ordering: invalidation owns the User lock first and consume waits, then correctly observes the new stamp (`scripts/test-mobile-api.ts:970-1019`). | A password/MFA/block/session invalidation can still race after credential validation and produce a fresh browser session bound to the post-invalidation stamp. The exact “credentials invalid by the time [the session] landed” invariant and `F234-R01` closure claim are not established. | Carry the validated stamp/session identity into Auth.js issuance and reject if it differs at the final session-mint boundary, or make issuance consume a database-backed grant whose validity is atomically bound to invalidation. Add the missing ordering: pause after successful consume/transaction commit, invalidate, then resume JWT/cookie issuance and prove no session cookie is emitted. |
| `09AD-R02` | **P2** | **The re-consent action abandons the failed logical turn it is meant to preserve.** The consent button navigates from Coach Chat to `coachSetup(true)` (`native-android/app/.../ZidRunApp.kt:315-334`). Saving setup pops all the way back to `RootDestinations.SHELL`, removing the Chat destination (`ZidRunApp.kt:362-377`). The retained idempotency key, pending question, and `pendingRunAnalysis` are private in-memory fields of that Chat `ConversationViewModel` (`ConversationViewModel.kt:96-135,178-213`), so its destruction loses the retry type and request ID. | The runner can grant consent but is returned to the shell instead of the refused turn; retrying requires reconstructing the action manually and may use a new request ID. `F234-R04` required preserving a real POST_RUN/chat retry after re-consent, not merely linking to the consent form. | Navigate back to the originating Chat after a successful consent edit and preserve the pending operation plus idempotency key across the setup round trip (saved state or an explicit result/operation contract). Automatically retry only if product policy says so; otherwise restore an actionable Retry. Cover CHAT and POST_RUN through refusal → consent → return/retry, including process recreation. |
| `09AD-R03` | **P2** | **A successful, billed TTS provider call is still inside the catch block labelled as provider failure.** After synthesis, `synthesized=true`, then the SUCCEEDED usage update runs inside the same `try` (`src/lib/coach/tts.ts:159-175`). If that accounting write fails, the catch assigns `OPENAI_TTS_FAILED`, attempts to mark the row FAILED, discards the already-produced buffer, and returns a 502; the cache key also remains held because synthesis succeeded but publication never ran (`:181-190`). The transcription path has the same provider-success-then-accounting coupling (`src/lib/coach/service.ts:430-441`). | A transient accounting/database error after provider success can charge money, return no audio/transcript, misreport a provider outage, and throttle same-key retries until the claim lease expires. The stale-PENDING lease repairs quota later but cannot recover the paid output or classify it correctly. | Separate provider outcome from terminal bookkeeping, make terminal accounting idempotently retryable, and never relabel a successful provider response as an OpenAI failure. Define a recoverable publication/response path for already-produced bytes and exercise terminal-update failure after provider success for both TTS and transcription. |
| `CFFA-R01` | **P2** | **The committed evidence row says “All eight addressed” although two advertised acceptance conditions remain partial.** The row states that row locks prevent invalidation between validation and consume and that the consent action fixes POST_RUN retry (`EXECUTION_PLAN.md:359`). `09AD-R01` shows the unprotected consume→JWT/cookie interval, and `09AD-R02` shows the pending operation is destroyed on successful re-consent. The row also reports test results that this review did not independently reproduce. | The sole progress tracker presents closure-grade evidence for security and native consent behavior that the source does not support, making later release decisions and multi-device pickup misleading. | Amend the evidence row to mark `F234-R01` and `F234-R04` partial/open with the exact remaining boundaries and distinguish author-reported validation from independent review. Keep the detailed reasoning here and status only in `EXECUTION_PLAN.md`. |

### Static status of the advertised remediation

| Prior finding / claim | Static status after `cffa228` |
|---|---|
| `F234-R01` invalidation-versus-handoff race | **Partial:** invalidation committed before/while validation is rejected; invalidation after consume commits but before JWT/cookie issuance is still accepted (`09AD-R01`). |
| `F234-R02` atomic publication and stale reservations | **Mostly implemented:** temp-file + rename prevents partial reads and stale PENDING rows are reconciled; post-provider terminal-accounting failure still loses/misclassifies paid output (`09AD-R03`). |
| `F234-R03`, `R05`, `R07`, `R08` | **Implemented by static inspection:** referrer policy, operations procedure, locale/destination mapping, and stricter debug-base validation are present. Runtime/production/device evidence was not reproduced. |
| `F234-R04` native consent remediation | **Partial:** the action reaches goal setup and inert consent Retry is suppressed, but successful re-consent discards the logical turn instead of preserving its retry (`09AD-R02`). |
| `F234-R06` test-evidence shape | **Improved:** the foreign-family fixture reaches ownership and production TTS is injectable. The added auth race still covers only invalidation-first ordering. |
| `EXECUTION_PLAN.md` evidence | **Correction required:** “All eight addressed” is inconsistent with the source findings above (`CFFA-R01`). |

### Static-review limitations

- No tests, build, lint, typecheck, migrations, browser, emulator, device, provider, database-race, or
  production checks were run, per instruction. Committed validation totals are author evidence only.
- Auth.js callback/cookie timing, PostgreSQL lock ordering, disk durability, provider billing, Android
  saved-state behavior, and the re-consent navigation round trip were reasoned about from source.
- Light/dark/race, en/fr/Arabic RTL, large text, TalkBack, offline behavior, and physical-device
  behavior remain unverified.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

## 19. Static code review — redesign commits `ced709d` through `69b85a2`

<!-- commit-review: ced709d88ce990bc3600cd5eb470b578480d2453 -->
<!-- commit-review: afa20e73eb7340688f86ececfc3b40461b1a0ebf -->
<!-- commit-review: 2528bf24687fe6ebb20712383d135803dea834d7 -->
<!-- commit-review: f333b29993706948955f59b55d6e8e64921287ac -->
<!-- commit-review: d1496f36eda37a8524aac0d8f55519fe379e6111 -->
<!-- commit-review: 7bcabb30dec27c1cb3766f609db06a3af2da1c7c -->
<!-- commit-review: 69b85a2bce2244c9aa0d70292e32b872f1b7bdb3 -->

### Review boundary and verdict

- **Reviewed range:** the seven previously unmarked commits from
  `ced709d88ce990bc3600cd5eb470b578480d2453` through
  `69b85a2bce2244c9aa0d70292e32b872f1b7bdb3`, against parent `3b52d1e`.
- **Scope:** the Runs/Coach diagnosis and proposed artifacts, native Phase 1–4 implementation,
  Phase 1 device captures, evidence rows, and the owner-requested session handoff. The exact commits
  supersede the uncommitted-worktree snapshot reviewed in §11A; still-open `NDP2-*` issues are
  revalidated below rather than assumed closed.
- **Visual comparison:** the approved Variant-B, Coach and run-detail proposal renders were compared
  with the committed Phase-1 Samsung captures at original resolution. Phase 1 broadly matches the
  intended hierarchy and puts the stateful action above the tab bar. No implementation/device
  captures for Phases 2–4 are committed; `7bcabb3` and `69b85a2` correctly disclose that the device
  pass was blocked by USB authorization.
- **Verdict:** **changes requested.** The redesign materially improves action reach, duplicate-card
  density, zero-progress honesty, scoped Coach counters, chart contrast, and visible recorder state.
  Three P1 paths remain: disk-backed runs can bypass the new start guard, saved-state restoration can
  suppress hydration of a finished run, and releasing after the completion haptic cancels the new
  hold-to-start pulse before navigation. The repository also still records the implemented visual
  and numeral choices as pending approval.
- **Release/status boundary:** dated review evidence only. This section changes no roadmap or gate;
  `EXECUTION_PLAN.md` remains the only progress tracker and `PRODUCT.md` the durable-decision source.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `RED-R01` | **P1** | **The Phase-1 start guard still ignores an interrupted run already on disk.** Active recordings are snapshotted with `finished=false`, while `restorePending()` returns only finished records (`RunRecorder.kt:135-160`). After process death the singleton is Idle, so `start()` accepts a new run (`:162-202`); the one-file outbox then replaces the old snapshot on the next save (`RunOutbox.kt:26-47`). The five new tests cover only in-memory Idle/Acquiring/Paused/Finished states (`RunRecorderStartGuardTest.kt:27-77`). This is the exact `NDP2-R01` boundary, unchanged in `afa20e7`. | A background/process-killed route can appear as Record-ready and be silently overwritten by the next recording, despite the commit and evidence describing the guard as the protection against route loss. | Resolve every occupied outbox before exposing Record. Restore `finished=false` as an explicit salvage/save/discard state, or block `start()` while any pending file exists; never replace a different pending `clientId` without explicit resolution. Add process-restoration/overwrite coverage for the disk state. |
| `RED-R02` | **P1** | **The new “surface once” flag can prevent even a finished outbox record from being hydrated after process recreation.** `pendingSurfaced` is `rememberSaveable`; when restored as `true`, the shell returns before calling both `restorePending()` and `resumeFinished()` (`ZidRunApp.kt:229-247`). `RunRecorder` is an in-memory singleton and restarts Idle, so the dock then offers Record even though `pending-run.json` still holds the finished run. The captured `am force-stop` path proves a cold flag (`false`), not Android saved-instance-state restoration with the flag already true. | An OS kill after the summary was surfaced once can strand a finished run, hide Save, and expose the same eventual overwrite path as `RED-R01`. The navigation-loop fix conflates “do not auto-open twice” with “do not hydrate.” | Always hydrate the recorder from disk when the singleton is empty. Gate only automatic navigation, using a pending-run identity/event rather than a saved Boolean; the dock must reflect the hydrated Finished state even when auto-navigation is suppressed. Verify cold launch, saved-state process recreation from shell and summary, back navigation, and a second distinct pending run. |
| `RED-R03` | **P1** | **The Phase-4 success pulse makes a completed 700 ms hold cancellable for another 300 ms.** The hold coroutine reaches `progress == 1`, emits the confirming haptic, then awaits the aura loop before `onTriggered()` (`StartRunScreen.kt:407-446`). Releasing in that interval sets `holding=false` (`:455-463`), which changes the `LaunchedEffect` key, cancels the completion coroutine, and starts the wind-back branch. The new `aura` value is not reset on that aborted branch either. `d1496f3` expanded the post-haptic cancellation window from the old 110 ms beat to 300 ms. | A runner naturally releasing when the UI/haptic says “complete” can get no run start; in practice the advertised 700 ms action requires holding through roughly 1 second and may leave a partial aura behind. This is a failure in the core Record flow, not decorative polish. | Latch success the instant progress reaches 100%. After that point release must not enter the abort branch; invoke start independently of the decorative pulse (or transition immediately and run the pulse without blocking). Reset transient visual state on every abort/disposal. Gesture-check release before 700 ms, exactly at completion, during the aura, and under reduced motion/TalkBack. |
| `RED-R04` | **P1** | **The commits implement choices that their own authority files still mark unapproved.** `RECOMMENDATION.md:3,77-84` says nothing is implemented and keeps the variant, empty-state direction, Western Arabic digits and typography pending; `UI_RULES.md:1-11,67-75,102-103,140-146` and `AGENTS.md` repeat that gate and require owner-approved mockups before Compose. `afa20e7` nevertheless implements Variant B, the lime empty hero, and globally normalizes bare Arabic to `ar-DZ` (`Format.kt:116-126`). `HANDOFF.md:48-51` confirms those durable decisions remain formally open. | Repository policy and product behavior disagree, and the numeral change affects every native screen using `currentLocale()`, not only Runs. A later session cannot distinguish an owner decision from an implementation assumption. | Obtain and record the four decisions, putting durable numeral/typography decisions in `PRODUCT.md`, then update the proposal status; otherwise revert/pause the pending-choice implementation. Do not treat “owner saw it” or approval to work in phases as answers to the four recorded asks. |
| `RED-R05` | **P2** | **The stateful dock is absent whenever remote overview data is loading or initially unavailable.** Loading and empty-error/offline branches return before the `else` branch that owns `RecordDock` (`RunsOverviewScreen.kt:103-120,224-230`). Local recorder state is independent of that request. | A Recording/Acquiring/Paused/Finished run loses its Runs-tab route back during a slow or failed fetch, contradicting the central “visible at every state/scroll position” promise. | Render the recorder-aware action above all remote-data branches, or provide the equivalent local action on loading/error/offline states. Add those combinations to the proposal and device acceptance matrix. |
| `RED-R06` | **P2** | **The trial “days left” value is one day low for almost the entire trial.** Phase 2 floors `Duration.between(now, endsAt).toDays()` and hides zero (`CoachScreen.kt:491-520`). The server defines a seven-day trial as signup time plus exactly seven 24-hour periods (`src/lib/coach/entitlement.ts:18,61-62`), so even seconds after signup the UI shows 6 days; with less than 24 hours it drops the count entirely. The web correctly uses `ceil` and a last-day state (`coach-dashboard.tsx:430-432`). The `remember(trialEndsAt)` value also does not advance while the screen remains composed. | Payment-adjacent status understates a new runner's entitlement immediately and becomes less informative on the final day, undermining the accuracy the reserved pill was meant to add. | Match the established entitlement semantics: ceil positive remaining time (or an explicitly approved calendar-day rule), show a localized last-day state, and recompute at an appropriate clock/lifecycle boundary. Cover just-created, 6d23h, 24h, under-24h, expiry, and malformed timestamps. |
| `RED-R07` | **P2** | **The new localization/large-text paths still contain literal plural grammar and deliberate information loss.** The week hero concatenates a count with one fixed `runs_overview_streak` string (`RunsOverviewScreen.kt:444-470`), producing French `1 semaines de série` and invalid singular Arabic. Phase 2 adds `%1$d séance(s)` rather than a plural resource (`values-fr/strings.xml:344`; `PlanWeekScreen.kt:206-210`). Separately, `OverviewMetric` and every dock state force one-line ellipsis (`RunsOverviewScreen.kt:619-640,323-351`); the committed 1.3× screenshot visibly renders `TOTAL DISTAN…`, and there is no French device capture for the longer dock/counter strings. | The commits fix one “1 runs” class bug while adding/retaining the same class in prominent momentum and Coach counters. Large text and longer locales can hide metric or action meaning in the primary surface. | Use locale plural resources for streak and weekly-session grammar (including Arabic categories); redesign metric/dock layouts so the action/state and metric label remain intelligible at target font scale instead of relying on ellipsis. Verify 0/1/2/many in en/fr/ar RTL and all dock states in French/Arabic at 1.3×. |
| `RED-R08` | **P2** | **The new “no timing” card infers a specific cause from derived-series emptiness and still hides elevation absence.** It claims the route has no per-point timing whenever splits are empty, pace has at most one point, and a route has more than one point (`RunDetailScreen.kt:223-233`). But timed short/stationary/filtered routes can also produce that shape: splits discard a remainder below 150 m and pace emits only after 250 m (`run-stats.ts:62-106,197-217`). The DTO already carries point-level `t`/`ele` (`Dtos.kt:330-345,411-436`), yet the screen does not inspect them. Elevation still disappears silently whenever its series has at most one point (`RunDetailScreen.kt:235-279`), contrary to the proposed “honest placeholder” rule. | Some runners receive a false technical explanation; others get no explanation for the missing elevation chart. The phase/evidence claim “honest empty series” is broader than the implementation. | Derive explicit availability/reason states from route data or, preferably, server-provided reason codes. Give timing/splits, pace, and elevation their own accurate absence states; do not equate an empty derived list with missing timestamps. Cover untimed, no-elevation, short timed, stationary/invalid-segment, manual, and fully populated routes. |
| `RED-R09` | **P2** | **The committed pickup documents retain claims contradicted by the same commits and captures.** `DIAGNOSIS.md:17-18` still says native tokens were ported 1:1 from web despite the documented dark-palette divergence. `EXECUTION_PLAN.md:364` says all 1:1 claims were removed and large labels wrap instead of truncate, while the diagnosis remains and the committed large capture/code ellipsize them. `RECOMMENDATION.md:3` still says “Nothing here is implemented”; the Phase-1 evidence calls the process-death route verified without covering `RED-R02`; and `HANDOFF.md:13-22` repeats these closure/gate claims as pickup context. The empty-state HTML also still closes `.screen` before the dock and ends with an unmatched `div` (`src/runs-empty.html:52-92`), relying on browser error recovery for its render. | The sole tracker, proposal status, handoff, and mock source do not describe one coherent state. A different-device pickup can trust the wrong approval, responsive behavior, or recovery boundary. | Reconcile the current evidence into `EXECUTION_PLAN.md`, mark the process-restoration boundary open, correct/remove the 1:1 and wrapping claims, and update the proposal from “nothing implemented.” Keep `HANDOFF.md` as context only by linking to current tracker rows instead of duplicating closure status. Fix the mock HTML nesting before treating it as implementation evidence. |

### Commit-by-commit static status

| Commit | Status after review |
|---|---|
| `ced709d` design pass | **Partial / changes requested:** strong measured diagnosis and useful artifacts, but formal decisions remain pending and the diagnosis/mock source retain `RED-R04`/`RED-R09`. |
| `afa20e7` Runs Phase 1 | **Changes requested:** hierarchy and in-memory state guard improve, while disk restoration, saved-state hydration, remote-error dock reach, plurals and responsive labels remain open (`RED-R01`, `R02`, `R05`, `R07`). |
| `2528bf2` Coach Phase 2 | **Changes requested:** scoped labels and orange-icon treatment are sound; trial arithmetic and localized weekly grammar are not (`RED-R06`, `R07`). |
| `f333b29` Runs Phase 3 | **Changes requested:** chart hues preserve the shipped chart/action structure; the empty-series explanation is not reliably truthful or complete (`RED-R08`). |
| `d1496f3` Runs Phase 4 | **Changes requested:** fastest-split secondary encoding is useful; the blocking aura introduces a core start-gesture race (`RED-R03`). |
| `7bcabb3` evidence | **Correction required:** it honestly leaves device verification open, but overstates “honest empty series” and inherits the implementation boundaries above. |
| `69b85a2` handoff | **Useful but stale as status:** it clearly lists the pending device/owner work, but should not duplicate closure claims that conflict with source; status belongs in `EXECUTION_PLAN.md` (`RED-R09`). |

### Static-review limitations

- Per instruction, no tests, build, lint, typecheck, render command, emulator/device interaction,
  database query, or runtime/API call was run. Validation totals in commit messages, the tracker and
  handoff remain author-reported evidence.
- The approved/proposed renders and all ten Phase-1 captures were inspected; the screenshots prove
  appearance at captured moments, not recorder process restoration, gesture timing, focus order,
  TalkBack, or navigation semantics. Phases 2–4 have no committed implementation captures.
- Android saved-state restoration, coroutine cancellation timing, process death, background GPS,
  locale grammar, dynamic font layout and offline behavior were reasoned about from committed source.
- The repository-required ZidRun app-review skill guided the review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

## 20. Static code review — commits `942bbc4` and `d9843ee`

<!-- commit-review: 942bbc438bcaa07cb9711e62c738a7acd94c135e -->
<!-- commit-review: d9843ee3d48cbce02a940c0cf9e08a0259c911f2 -->

### Review boundary and verdict

- **Reviewed commits, oldest first:**
  `942bbc438bcaa07cb9711e62c738a7acd94c135e` and
  `d9843ee3d48cbce02a940c0cf9e08a0259c911f2`, against parent
  `69b85a2bce2244c9aa0d70292e32b872f1b7bdb3`.
- **Scope:** the §19 `RED-R01`–`R09` remediation, recorder/outbox recovery, hold completion,
  Runs/Coach plural and responsive changes, run-detail absence states, product/proposal authority,
  and the 20 new Samsung M21 device captures. The current Runs/Coach flow documents, proposed UI
  rules, and relevant approved reference images were used for comparison.
- **Visual comparison:** all 20 new device captures and the relevant approved Runs/Coach references
  were inspected at original resolution. The captures support the improved Runs hierarchy, dock
  reach, Coach scope labels, three-theme chart hues, French singular, and the valid untimed-route
  explanation. They also expose mixed Arabic numerals and unreadable light-theme system-bar icons.
- **Verdict:** **changes requested.** The original same-account happy paths for `RED-R01`, `R02`,
  `R03`, `R05`, `R06` and the specific new plurals are materially improved. Recovery is not yet a
  safe account or storage boundary, chart absence remains incomplete, and the device/tracker claims
  overstate the numeral and visual-acceptance result.
- **Release/status boundary:** review evidence only. No release or acceptance gate closes here;
  `EXECUTION_PLAN.md` remains the sole progress tracker and should be corrected rather than this
  review being treated as one.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `P234-R01` | **P1** | **Recovered routes are not bound to the account that recorded them.** `PendingRun` persists only the request, finished flag and timestamp (`RunOutbox.kt:84-89`). The new shell path restores and auto-opens any pending file whenever *any* user reaches the signed-in shell (`ZidRunApp.kt:230-258`). Sign-out clears tokens and appearance only (`SessionManager.kt:155-166`; `AccountViewModel.kt:134-147`; `ZidRunApp.kt:557-567`), and the summary reconstructs the request and posts it through the currently authenticated repository (`RecordRunViewModel.kt:33-69`). | On a shared phone, account B can be shown account A's precise route after A signs out and can save a free run under B. A foreign `workoutId` may instead make the route unsaveable, but the location disclosure has already happened. Broadening recovery to interrupted snapshots makes this cross-account path cover live-route remnants too. | Persist an immutable owner user ID with every snapshot and enforce it before hydration, display, discard and upload. On voluntary sign-out, require an explicit save/discard decision or keep the record inaccessible until that owner returns; on revocation/account deletion follow an explicit purge policy. Verify A-records → sign out/revoke → B-signs-in, including finished and interrupted records and process recreation. |
| `P234-R02` | **P1** | **Outbox I/O failures are swallowed, and the new disk guard turns an unreadable or undeletable file into a permanent false-Idle trap.** `save()`, `load()` and `clear()` discard every exception; `save()` also ignores a failed `renameTo` (`RunOutbox.kt:42-68`). `load()` can therefore return null while `hasPending()` remains true. The shell then hydrates nothing (`ZidRunApp.kt:246-249`), the dock advertises Record from the Idle singleton (`RunsOverviewScreen.kt:255-281`), but `start()` refuses solely because the file exists (`RunRecorder.kt:192-195`). `beginRecording()` interprets every refusal as an active recording and navigates to the live screen (`StartRunScreen.kt:254-268`), even though state is still Idle. A failed snapshot also silently removes the durability the recovery claim depends on. | A corrupt/old snapshot, full disk, permission/I/O failure, failed rename, or failed discard can either lose the run on process death or leave Record visibly available but non-functional until app data is cleared. The UI provides neither an explanation nor a safe repair path. | Make outbox operations return explicit states/results such as Empty, Valid, Corrupt and I/O failure; verify atomic publication/rename and deletion. Surface a localized recovery action that preserves/quarantines recoverable bytes and allows an explicit discard when necessary. `start()` and navigation must distinguish an active run from a blocked outbox, and durability failures during recording must be visible. Cover corrupt JSON, incompatible schema, write/rename/delete failure and retry. |
| `P234-R03` | **P2** | **`RED-R08` remains partial because splits and pace still share one absence predicate and manual/invalid routes still get no truthful reason.** The new card is considered only when a route has more than one point, and timing copy appears only when *both* splits are empty and pace has at most one point (`RunDetailScreen.kt:223-262`). A short timed run can have a trailing split but no two-point pace series, so the pace section disappears silently. Manual/no-route and one-point runs skip the absence card entirely. Routes with two timestamps but only stationary, non-positive-time, or ≥15-second-gap segments are labelled “too short,” although the server filters those segments for different reasons (`run-stats.ts:40-58,62-106,197-217`). | The seeded untimed capture is now honest, but other supported run shapes still hide a metric or give a false cause. The implementation and evidence therefore do not satisfy the prior requirement for separate splits, pace and elevation availability. | Model availability per metric, preferably with server reason codes shared by web/native. Render independent truthful states for splits, pace and elevation, including manual/no-route, one-point, timed-short, stationary/invalid-gap, no-elevation and fully populated routes. Do not suppress one metric's explanation merely because another metric rendered. |
| `P234-R04` | **P2** | **The Western-digit remediation fixes four new plurals, not the recorded app-wide numeral policy.** `ZidRunFormat.count()` is used by the new week/streak/trial plurals, but Arabic resources still contain many `%d` placeholders, including `coach_of_n`, `runs_step_minutes`, `runs_overview_count_summary`, setup steps and race/run values (`values-ar/strings.xml:39,83-99,211,228-233,302,340,353-356,366,407,436,488,565-567`). `SessionsRing` itself renders `completed.toString()` beside `stringResource(coach_of_n, planned)` (`CoachScreen.kt:450-480`). The new `p234-coach-overview-ar.png` visibly shows Western `3` over Arabic-Indic `٦`, and its workout target mixes Western `9,0` with Arabic-Indic `٥٥`. This contradicts the one-system-per-surface rule and `PRODUCT.md:74-80`'s statement that the provisional choice is app-wide. | Arabic remains internally inconsistent in prominent Coach/Run surfaces even though the follow-up commit and tracker describe the mixed-numeral regression as fixed. Screen-reader output and visual alignment can also vary between ad-hoc integer paths. | Centralize all displayed numeric formatting through the chosen locale/numbering system, replacing resource-locale `%d` formatting where the provisional Western-digit policy applies; localize matching semantics strings too. Audit every Arabic `%d` call site and verify representative 0/1/2/many counts, times, distances, setup steps and the Coach ring in one captured surface before claiming app-wide consistency. |
| `P234-R05` | **P2** | **The light app theme does not drive system-bar icon appearance, and every newly committed light capture shows near-invisible status information.** `MainActivity` calls parameterless `enableEdgeToEdge()` once (`MainActivity.kt:33-52`), whose automatic light/dark choice follows the system configuration. ZidRun independently selects Light/Dark/Race inside Compose through `AppearanceController.themeMode` (`AppearanceController.kt:24-48`; `ZidRunApp.kt:127`). On the captured dark-system/light-app combination, the clock, connectivity and battery icons are white on the `#F9FAFB` background in the light Coach, Runs and run-detail images. | Time, connectivity and battery state are effectively unreadable in light mode—the exact outdoor/mobile context this feature targets. Theme switching can leave platform chrome inconsistent with the app surface even when in-app contrast is correct. | Drive edge-to-edge `SystemBarStyle`/window-insets-controller appearance from the active ZidRun theme: dark foreground icons for Light and light icons for Dark/Race, updated immediately on theme changes. Verify status and navigation bars in all three app themes while the OS itself is in both light and dark mode. |
| `P234-R06` | **P2** | **The committed “phases 2–4 verified” evidence is still a sampling pass and overstates closure.** The 2026-08-05 tracker row says the numeral regression is fixed, while its own Arabic Coach capture proves `P234-R04`; it also leaves `EXECUTION_PLAN.md`'s `Last updated` at 2026-08-04 (`:7,360-363`). The new set contains only an acquiring/zero-distance live screen—no fastest split, stable GPS, auto-paused, paused or 1.3× live state—and 1.3× evidence only for the Runs overview, not the changed Coach header or detail/live surfaces. No run-detail/live French or Arabic capture is present. `PRODUCT.md` also duplicates mutable closure status (“five P1 conditions ... remediated”) inside a file whose header says status/evidence never live there (`PRODUCT.md:3-4,68-80`). | A later release/pickup can treat a partial capture set as completion evidence and miss exactly the numeral/system-chrome defects visible in those artifacts. Stable product authority can also go stale as review findings reopen implementation boundaries. | Amend the 2026-08-05 evidence row to distinguish the cases actually observed from the still-open matrix, record `P234-R01`–`R05`, update the tracker date, and remove remediation status from `PRODUCT.md` while retaining only the Variant-B decision and clearly provisional choices. Add the missing phase-specific theme/locale/font/state evidence before calling phases 2–4 device-accepted. |

### Static status of the advertised §19 remediation

| Prior finding / claim | Static status after `d9843ee` |
|---|---|
| `RED-R01` / `RED-R02` valid same-account process recovery | **Implemented for a readable outbox:** interrupted and finished snapshots hydrate without the saved-navigation flag suppressing them. Account ownership and explicit storage-failure states remain open (`P234-R01`, `P234-R02`). |
| `RED-R03` hold-release race | **Implemented by source inspection:** completion is latched before the decorative aura, so release no longer cancels the owed start. Permission-denial retry remains available through the separate Grant permission action. |
| `RED-R04` proposal authority | **Improved:** Variant B is recorded as decided and the other three choices remain explicitly provisional. Mutable remediation status should not live in `PRODUCT.md` (`P234-R06`). |
| `RED-R05` dock under loading/error | **Implemented by source inspection:** the local recorder dock now renders outside the remote-data branch. |
| `RED-R06` trial arithmetic | **Implemented by source inspection:** positive remaining seconds use ceiling semantics and the final partial day has localized copy. Boundary/runtime behavior was not executed in this review. |
| `RED-R07` new plural/large-label cases | **Implemented for the four changed plurals and captured Runs label:** the wider app-level numeral claim remains false (`P234-R04`). |
| `RED-R08` honest metric absence | **Partial:** the untimed/no-elevation fixture is correctly explained; independent metric and invalid/manual route states remain (`P234-R03`). |
| `RED-R09` documentation consistency | **Partial:** the proposal is more current, but tracker/product evidence still overclaims and duplicates status (`P234-R06`). |

### Static-review limitations

- Per instruction, no tests, build, lint, typecheck, render command, emulator/device interaction,
  database query, or runtime/API call was run. Validation totals and gesture/device observations in
  the commit messages and tracker remain author-reported.
- The 20 committed phase-2–4 captures and relevant approved reference images were inspected at
  original resolution. PNGs prove only their captured state; they do not prove touch timing,
  TalkBack/focus order, process/account transitions, outbox I/O behavior or system-inset semantics.
- The repository-required ZidRun app-review skill guided this review. The separately referenced
  `impeccable` skill was unavailable in this workspace.

## 21. Physical-device UX review — Runs, race registration and Coach (2026-08-05)

<!-- commit-review: 0295eae073aac60f01bfb462e2c5778a42b83423 -->
<!-- commit-review: 67bc6749d38c074a615310734cbd6726ab728891 -->
<!-- commit-review: 35761e66ccb33c3083541e013ab26e1818283adf -->
<!-- commit-review: b03232b8a104f05b5f6c63294dc2c0d608e9ac16 -->
<!-- commit-review: 38d65b4bd87adfc21087332b91457b85e77948ce -->
<!-- commit-review: 43075843da44cc5465bee89fb70428218a3cce10 -->
<!-- commit-review: 9ecb58e1aa3877ec224e4511c449f91acd80f590 -->
<!-- commit-review: a504549d3af547485e3342598e32c5d6027e9327 -->
<!-- commit-review: 999a7e2af7b3629cc7a6ec45ed21211a9af583ee -->
<!-- commit-review: d411429ecc6b2ba4075e9ccfb4413342d17b1670 -->
<!-- commit-review: e330ec867386d345a347e04c0efc80c0316e27f9 -->
<!-- commit-review: 6f6ed04682f862d7ce2491aa1f18a02debd46a86 -->
<!-- commit-review: a043d724b85d59d7b3e6bcd9876fb9133f383179 -->
<!-- commit-review: f07068388a65afd376d3cf3770c7f4a1a754e7c9 -->
<!-- commit-review: 7433372ac185a9cd6381f5bbd5cd2ea0c6f501a0 -->
<!-- commit-review: 8c15d7f215c60aff4e1243b2ac521b9787a640a7 -->
<!-- commit-review: d9f391ad8334378e543d6c0190004258f8f591c8 -->
<!-- commit-review: 7885b1d72a1e5ec809f3ce920a925b3d59b5531c -->
<!-- commit-review: d9a7d0153fc2ce636c6bc8ddd6de0235d6236a1b -->
<!-- commit-review: 3653a4fe2d11732dc68a2f667c94c6eb0429b380 -->
<!-- commit-review: 6dba58999319cd7ada718bcc179d3739807d58f4 -->
<!-- commit-review: cdb4f34bb8d8a221c892442f7456cd8761232e1e -->
<!-- commit-review: f734a9c42990432c2748735fceaa11133e83f2f7 -->
<!-- commit-review: eb3f01601f87591ec473e08b2394adec39099f4b -->
<!-- commit-review: 5f134c3ecf9e38d90246f686e9bbf51b690720a8 -->
<!-- commit-review: 7c3e10a8593fc1497059a9c540b2bdf9bb648a31 -->
<!-- commit-review: ebe21766dfa4d58628b1dcdf95650c94b967bcba -->

### Rewritten-history reconciliation (2026-08-06)

- The feature branch was rewritten after the earlier reviews, changing commit IDs without changing
  the reviewed trees. For 21 commits, each current commit has the same subject and exact Git tree as
  its previously marked counterpart, and the parent sequence is tree-equivalent. Their current IDs
  above therefore inherit the existing commit-by-commit findings; the older markers remain as
  historical evidence rather than being deleted.
- Three current-history commits had no standalone marker before this reconciliation and were
  reviewed directly against their diffs and the approved Coach/Races references:

| Commit | Review result |
|---|---|
| `8c15d7f` | **No new finding.** The Coach consent review now echoes each non-empty free-text health answer before consent, and the unfiltered Races empty state gains a Retry action. This closes the two dead ends recorded by its device pass; the broader pull-to-refresh and conditional empty-copy gap remains `NATPAR-008`. |
| `d9f391a` | **No new finding.** Documentation-only evidence narrows `COACHPAR-001` to what the Galaxy M21 actually proved and leaves the remaining voice states open; it does not close a release gate. |
| `7885b1d` | **No new finding.** Documentation-only change promotes the surviving device observations to `NATPAR-008`, `NATPAR-009` and `COACHPAR-007` in `EXECUTION_PLAN.md`, preserving that file as the sole tracker. |

- The review-coverage baseline is migrated from the pre-rewrite `a18e9b9` to its exact current-tree
  counterpart `b03232b8`. The checker now fails closed when that baseline is not an ancestor instead
  of silently reporting success (`DEV-R09`).
- This reconciliation used source and original-resolution approved references only; no test suite,
  build, emulator, device rerun or live API request was performed.

### Review boundary and verdict

- **Reviewed commits:** the current-history P234 remediation commit `0295eae073aac60f01bfb462e2c5778a42b83423`,
  the wireless-debugging runbook `67bc6749d38c074a615310734cbd6726ab728891`, and the later review-hook/CI
  commit `35761e66ccb33c3083541e013ab26e1818283adf`. The installed APK was assembled from the tree at
  `67bc674`; that tree is byte-for-byte identical to the earlier `08e9e20` runbook commit from before
  the local history rewrite. `35761e6` changes review/CI files only, so it does not make the APK stale.
- **Device/runtime:** Samsung Galaxy M21 (`SM-M215G`), Android 13, 1080×2340, density 420, connected
  through Wi-Fi ADB to the local seeded backend with `adb reverse tcp:3003 tcp:3003`. The debug APK
  was `0.8.0-debug` (version code 8).
- **Exercised:** open and closed race detail, category selection, the complete details→registration→
  payment path, keyboard focus, Runs overview/start/live/pause/finish/zero-distance discard, Coach
  overview/plan/chat and Coach→run handoff, light/dark/race themes, English/French/Arabic RTL, and
  1.3× font scale. The temporary zero-distance run was discarded; the seeded test registration was
  intentionally created in the local database. Locale, Light theme and 1.0 font scale were restored.
- **Verdict:** **changes requested.** Variant B makes recording much easier to start and the main
  Runs/Coach hierarchy is strong, but four P1 product paths remain: registration can submit without
  its approved review step, the keyboard and unexplained required fields can block submission,
  payment can be offered with no destination, and LTR Coach instructions are reordered in Arabic
  RTL. Five P2 implementation/operational defects are recorded below.
- **Status boundary:** this is review evidence, not a progress tracker and not a release acceptance.
  No gate closes here; `EXECUTION_PLAN.md` remains the sole tracker.

### Findings

| ID | Severity | Finding and evidence | Impact | Acceptance condition |
|---|---|---|---|---|
| `DEV-R01` | **P2** | **The P234 system-bar fix is app-theme-aware but not route-surface-aware.** With the app in Light, both the always-dark pre-run screen and always-dark live screen draw black clock/battery/signal icons on black; the pre-run Back arrow is also nearly black. The device captures reproduced this on both routes. `ZidRunApp.kt:137-149` derives platform icon appearance only from `appearance.themeMode`, while `StartRunScreen.kt:91-96,138-144` and `RecordingScreen.kt:179-185` deliberately force dark surfaces independent of that mode. | Platform status and the only visible in-app Back affordance become effectively invisible at the exact outdoor moment when the runner is starting or controlling a run. The light-shell screenshots added by `0295eae` do not cover these forced-dark destinations. | Make system-bar appearance destination/surface-aware and give the pre-run top bar explicit dark-surface colors. Verify start, acquiring, stable, paused and summary routes in all three app themes while the OS is independently light and dark. |
| `DEV-R02` | **P1** | **The native registration path discards the category already selected on Race Detail and skips the approved review step before creating the entry.** On-device, selecting 5K and tapping Register reopened an unselected 5K/10K choice. `RaceDetailScreen.kt:156-162,222-230,330-335` owns the selection, but `ZidRunApp.kt:498-502` ignores it and `Destinations.registration()` carries only the race ID. `RegistrationStep` contains only Distance, Details, Payment and Done, and `submit()` posts immediately from Details (`RegistrationViewModel.kt:26-31,149-186`). This contradicts the approved `details → review → submitted` sequence and review contents in `docs/races-design/RACE_DESIGN_FLOW.md:56-63`. The selected-category price is also labelled “From” (`RaceDetailScreen.kt:237-247`) instead of as the exact selected price. | Runners repeat a decision, see no step progress, and can create a consequential registration without one final chance to catch the race, distance, personal data, price or sharing scope. | Carry the selected category into registration, show a visible/announced 1-of-3 progression, add the approved review screen, and create the registration only from its final Confirm action. Repeat race, category, runner, exact price/status and organizer-sharing scope; preserve state across Back and recreation. |
| `DEV-R03` | **P1** | **Required-field and IME behavior can leave the registration form apparently impossible to submit.** Emergency name and phone are required only inside `canSubmitDetails` (`RegistrationViewModel.kt:59-65`), but the screen labels neither as required and gives no reason when Confirm is disabled (`RegistrationScreen.kt:242-271`). On the Galaxy M21, tabbing from Emergency contact name focused the phone field at y=1363–1531 while the keyboard began at about y=1349, hiding the focused control completely. Root `imePadding()` exists (`RegistrationScreen.kt:95-102`), but no field requests bring-into-view on focus. | A runner who filled every visibly required item can accept the rules and still face a dead disabled CTA; keyboard users and TalkBack/physical-keyboard users lose the field they are editing. This blocks the core registration task. | Mark required versus optional fields explicitly, validate on blur/submit, and show a localized CTA-level or inline explanation for every unmet condition. Bring the focused field above the IME (including Next actions), then verify narrow screen, 1.3× text, TalkBack and English/French/Arabic keyboards. |
| `DEV-R04` | **P1** | **The Payment state can ask for proof without telling the runner where to pay.** The seeded paid race returned no BaridiMob/CCP values; the device still showed BaridiMob, CCP and Bank transfer, selected BaridiMob by default, and enabled “Choose a screenshot.” Native code conditionally prints nullable details but has no empty-instructions state, then always renders all three choices (`RegistrationScreen.kt:283-337`). The DTO explicitly permits all fields to be null (`Dtos.kt:145-151`); web parity already handles that valid state with `noDetails` copy (`src/app/account/registrations/payment-panel.tsx:52-81`). | The runner's place is held but payment cannot be completed with confidence: there is no account, recipient, reference or recovery/contact instruction, and Bank transfer is offered without a bank destination in the contract. | Render only payment methods backed by usable instructions. When none exist, state that the organizer has not supplied payment details and expose the organizer contact/recovery path; do not preselect a fictional method or invite proof upload. Add a contract for any genuinely supported bank-transfer destination. |
| `DEV-R05` | **P2** | **Coach overview presents plan-wide and same-day data as weekly/next data.** The device shows “This week · 3 of 6” followed by “Sessions completed — whole plan,” while Plan says “1 of 3 sessions this week.” `CoachScreen.kt:222-253` combines a `coach_this_week` heading with active-plan adherence. The adjacent “Next workout” is the exact same 05 Aug interval session as Today's workout because the API says “after today's” but queries `scheduledFor > date_trunc('day', NOW())`, which still includes every workout later than midnight today (`src/app/api/v1/coach/route.ts:47-60`). | The two most prominent progress/schedule cards contradict each other and reduce trust in the coach's plan: a runner cannot tell whether 3/6 is this week or the whole plan, nor what actually comes next. | Either calculate genuine weekly adherence or title the card “Whole plan” consistently. Define next as strictly after the current/today workout (exclude its ID or start at the next day), and cover today, multiple same-day workouts, timezone boundaries and no-next-session states. |
| `DEV-R06` | **P2** | **“Log this run” carries the workout ID but opens in Free run, so the planned guidance is off by default.** The physical handoff displayed Free run as selected; Guided had to be tapped manually before the interval steps appeared. `StartRunScreen.kt:107-117` receives the explicit workout ID but initializes `RunMode.Free`; `beginRecording()` still associates the ID while deliberately starts no `GuidedSessionController` in Free mode (`:254-273`). | The run can count against the plan, but the runner who launched an interval session from Coach gets no step changes or workout cues unless they notice and switch modes. That breaks the expected Coach→guided-run continuity. | When a non-null workout ID opens the screen, default to Guided, show the selected workout/steps immediately, and keep an explicit “record without guidance” escape hatch. Preserve the workout association in both modes and verify offline/no-session fallback copy. |
| `DEV-R07` | **P1** | **Cross-language Coach content is not bidi-isolated, and Arabic RTL changes the meaning/order of the workout instruction.** The test goal's Coach language is English by design while the app locale was Arabic. On-device, `6 × 800 m … Stop …` was visually reordered into a sentence beginning with the trailing `m at 5K...` and ending with `800 × 6`; the Runs date also rendered in a confusing `17:30 ,2026 أوت 3` order. The product intentionally stores a separate plan language (`Dtos.kt:768-773`), but `CoachScreen.kt:365-420` inserts title/intensity/instructions as raw text into an RTL paragraph, and `ZidRunFormat.dateTime()` returns an unisolated bidi-neutral date/time string (`Format.kt:20-43`). The same Arabic Coach surface still mixes Western distances/counts with Arabic-Indic minute values, confirming the provisional app-wide numeral audit is incomplete. | Reordered interval quantities are not cosmetic: a runner can misread the prescribed work/recovery structure. Dates and mixed digits also fail the equal-locale readability requirement in `NATIVE_APP_DESIGN_FLOW.md:118-127`. | Carry or infer content language/direction for server Coach text, render English/French plan strings as isolated LTR blocks inside RTL chrome, and isolate date/time/pace/phone tokens without mirroring them. Make the current Coach language visible/editable. Finish the selected numeral-system audit after owner ratification and capture mixed app-language/Coach-language combinations. |
| `DEV-R08` | **P2** | **No-route states spend most of the live/save viewport on an empty map and promise a photo action that does not exist.** While GPS was acquiring, `RecordingScreen` gave a flexible, minimum-144dp map box all remaining height and overlaid only “Searching” (`RecordingScreen.kt:320-344`), making a large near-blank panel look broken. The zero-distance summary always reserves a 1.5:1 map (`RunSummaryScreen.kt:90-103`) even when there are fewer than two points, pushing Discard two screens down. The finish dialog says title and photos can be added next (`values/strings.xml:338`), but Summary offers only title, notes and effort (`RunSummaryScreen.kt:130-148`). | Acquiring feedback is weak outdoors, core controls compete with dead space, and the post-run promise is false. A failed-fix run requires unnecessary scrolling just to discard safely. | Replace the untrusted/acquiring map with a compact signal/status panel and actionable permission/GPS guidance; show the map only after a trusted route exists. Collapse the summary map to a compact “No route captured” state, keep save/discard reachable, and either add the promised photo flow or remove that copy. |
| `DEV-R09` | **P1** | **The new commit-review enforcement silently disables itself on the current branch.** Running `node scripts/check-commit-review-coverage.mjs --head HEAD` at `35761e6` prints that HEAD is outside the history starting at `a18e9b9` and exits 0. The script explicitly returns success when the fixed start is not an ancestor (`scripts/check-commit-review-coverage.mjs:76-82`). Because the current history was rewritten, this is the normal branch state, so both pre-push and CI can report success without checking a single commit. | The hook/CI mechanism added to guarantee every commit is reviewed currently guarantees nothing on `feat/coach-tier0`; rewritten/unfetched history is treated as approval instead of a configuration failure. | Fail closed when the configured baseline exists but is not an ancestor, or require an explicit reviewed baseline/migration for rewritten history. CI should fetch history, establish the exact intended range, and demonstrate one covered, one missing, metadata-only, rewritten-history and shallow-clone case. Keep review-only commits exempt without exempting workflow changes. |

### What worked well on the physical device

- Variant B solves the original Runs complaint: Record run stays visible and thumb-reachable in
  Light, Dark and Race, in English/French/Arabic RTL, and at 1.3×. The stats scroll behind it without
  truncating the metric values.
- The zero-distance guard is honest and safe: Save stays disabled, explanatory copy is present, and
  the two-tap Discard returned cleanly to Runs. The local state did not get stuck after the exercise.
- Coach keeps Today's workout and Log this run above the fold at 1.0× and 1.3×. The chat composer is
  brought above the keyboard correctly, unlike registration.
- The Light shell system-bar fix from `0295eae` is effective on normal Light Runs/Coach screens; Dark
  and Race overview contrast is also strong. `DEV-R01` is specifically the forced-dark route gap.

### Runtime evidence and limitations

- The debug APK cold-start measurement was 3,456 ms. A short `gfxinfo` sample reported 189 frames,
  15.34% janky (legacy 22.75%), 50th percentile 19 ms and 90th percentile 36 ms. Debug startup,
  localhost networking and the small sample make this a profiling lead, not release-performance
  acceptance; repeat on a signed/profileable build before setting a performance finding.
- The current debug APK assembled successfully with JDK 17. No lint, unit, instrumentation,
  Playwright, production build or full automated suite was run as part of this device-focused pass.
- No real outdoor movement/stable route, auto-pause, background/process-death recovery, payment-proof
  upload, organizer payment account, account switch, offline transition, TalkBack audio pass or
  release-signed build was exercised. No captured precise route was produced.
- Device screenshots and UI hierarchy dumps remain temporary under `/tmp`; none are committed because
  they contain seeded account/registration data. Findings above record the durable observable state
  and exact source boundary.
- The repository-required ZidRun app-review skill guided the pass. The separately referenced
  `impeccable` skill was unavailable in this workspace.

## 22. Merge-time remediation review (2026-08-06)

<!-- commit-review: 4a5dd757ef4c923e01d2633c1bf0d58715e34f73 -->
<!-- commit-review: b3b469e5f70a616459def743bc336c333dc09295 -->
<!-- commit-review: 6e61926be23762f0cdd4bc26aedeac5a01970dd5 -->

### Review boundary and verdict

- **Reviewed commits:** `4a5dd757ef4c923e01d2633c1bf0d58715e34f73`, its focused structured-list
  follow-up `b3b469e5f70a616459def743bc336c333dc09295`, and the payment-destination fix
  `6e61926be23762f0cdd4bc26aedeac5a01970dd5`, against the §21 device findings, the approved
  Coach/Races references and the current native design flow.
- **Verdict:** **no new standalone finding; partial remediation accepted by source inspection.** The
  commit fixes the source causes observed for `DEV-R01`, `DEV-R05`, `DEV-R06` and the safety-critical
  workout-instruction portion of `DEV-R07`, plus the missing-destination path in `DEV-R04`.
  Device/runtime acceptance remains open, and these commits do not touch `DEV-R02`, `DEV-R03` or
  `DEV-R08`.

### Remediation status

| Finding | Source-review result |
|---|---|
| `DEV-R01` | **Implemented, device matrix pending.** The forced-dark start and live routes now request light platform icons for their lifetime, restore the shell theme on exit, and the pre-run top bar explicitly uses the dark palette. Route-transition ordering and all theme × OS-theme states were not rerun on hardware. |
| `DEV-R04` | **Implemented, payment runtime pending.** The payment screen now lists only BaridiMob/CCP methods backed by an actual destination, never offers unsupported bank transfer, derives a valid default when only CCP exists, and hides proof upload when no usable destination exists. The localized empty state says the held entry remains recoverable under My registrations. No organizer-details or proof-upload path was rerun. |
| `DEV-R05` | **Observed contradiction fixed; boundary cases pending.** The active-plan ratio is titled “Whole plan” in en/fr/ar, and the API selects the first planned running workout from tomorrow onward rather than returning today’s workout twice. Multiple-same-day policy, database/runner timezone boundaries and the no-next state were not executed. |
| `DEV-R06` | **Implemented, runtime fallback pending.** A non-null Coach workout ID initializes Guided mode while Free remains selectable. Session-loading, missing-session and offline behavior were not executed. |
| `DEV-R07` | **Safety-critical rendering fixed; broader acceptance remains open.** First-strong isolation now wraps date/time tokens, workout titles/intensity/instructions across overview and plan detail, the next-workout title, latest review summary, conversation summary, recovery advice and data-gap lists. This directly protects the `6 × 800 m` instruction that reordered on the M21. Other structured reply fields, current-language visibility and the app-wide numeral audit remain outside these commits. |
| `DEV-R09` | **Implemented by the preceding review-metadata commit `2fce70f`.** The current-tree baseline is explicit and rewritten/non-ancestor history fails closed. The coverage checker reports all 27 prior reviewable commits covered; its own review-metadata commit is exempt. |

### Limitations

- Per the merge instruction, no app test, build, lint, typecheck, emulator/device run, database query
  or live API call was performed. Review was against the exact committed diff only.
- `EXECUTION_PLAN.md` remains the sole progress/release tracker; this section is review evidence and
  closes no gate.
