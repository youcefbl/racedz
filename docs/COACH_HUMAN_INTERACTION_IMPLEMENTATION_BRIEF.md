# Native Coach human-interaction implementation brief

This document defines the first-release interaction improvements for the native Android Coach. It is
a design and implementation reference, not a progress tracker. Status, priorities, evidence, and open
release actions belong only in [`EXECUTION_PLAN.md`](../EXECUTION_PLAN.md).

The Android app in `native-android/` is the only Coach client in scope. ZidRun will not build this
Coach experience for Capacitor or the website.

## 1. F1 and F2 review baseline

### F1 — Darija recovery questions rejected as off-topic

**Verdict: approved at code and focused-regression level.**

Commit `afb85a1` expands the deterministic topicality gate with Algerian Darija and arabizi training
vocabulary while retaining negative controls for genuinely off-topic questions.

Evidence reviewed:

- The original question `وش نديري كي نحس روحي عيانة؟` is covered directly.
- Arabic-script Darija, arabizi, MSA, English, and French positive cases are covered.
- Darija, MSA, English, and French off-topic negative controls remain refused.
- `npm run test:coach-topicality`: **20/20 passed**.

The topicality list should continue to prefer a bounded paid false positive over incorrectly teaching
a runner that the Coach cannot discuss a genuine running or recovery concern.

### F2 — all blocked replies rendered as one native string

**Verdict: code and focused automated acceptance complete; physical-device acceptance remains.**

Commit `3d06748` correctly distinguishes the two blocked states:

| Interaction status | Safety level | Meaning | Native treatment |
|---|---|---|---|
| `BLOCKED` | `CLEAR` | Off-topic refusal | Informational |
| `BLOCKED` | `BLOCKED` | Urgent safety refusal | Urgent/warning |

The client now prefers the server's deterministic response summary and uses native strings only as a
fallback. This prevents an off-topic refusal from automatically telling the runner to see a doctor
and prevents a genuine symptom block from being replaced by unrelated generic copy.

The deterministic urgent response now gives the reviewed action in EN/FR/Darija: stop exercise;
call Algeria Civil Protection on `14` or `1021` when chest pain, fainting, or breathing difficulty
is current or returns; and do no running or strenuous activity until a healthcare professional has
assessed and cleared return to exercise. The authoritative Arabic off-topic response is Darija, and
the native presentation-matrix tests cover the blocked, caution, failed, legacy, and unknown states.

The remaining acceptance is physical: re-check visual prominence, TalkBack order, RTL, large text,
and both block styles on the signed phone candidate.

### Verification note

The focused F1 suite and native localization parity were green during review:

- `test:coach-topicality`: 20/20;
- `check:native-i18n`: 692 EN/FR/AR keys consistent.

The combined native Coach and Runs modules now compile, their focused unit tests pass, and both
modules pass `lintDebug`. This is automated evidence only, not a substitute for the signed-device
pass.

## 2. Feature summary

Improve the native Coach conversation so a runner receives concise, attentive, context-aware, and
safe guidance connected to their actual goal and training state.

The first release includes:

- the completed F1/F2 work and the F3–F7 safety/localization baseline;
- a shorter, answer-first response layout;
- clarification questions for ambiguous input;
- quick-reply options;
- a **Not what I meant** repair path;
- human-readable advice provenance.

It does not include proactive notifications, Coach personality settings, expanded durable memory,
website Coach work, Capacitor parity, or automatic plan changes.

## 3. Primary user outcome

Within approximately five seconds of reading an ordinary response, the runner should understand:

1. the Coach's direct answer;
2. what to do next;
3. whether a safety concern changes that advice;
4. what information the answer relied on.

The runner should not need to read a long technical card to find the recommendation.

## 4. Design direction

Use a **restrained, trust-first product UI** built entirely from the existing native ZidRun design
tokens.

Scene: a runner checks the Coach on a phone immediately after a run or while deciding whether to
train. They may be tired, outdoors, and giving the screen limited attention.

Interaction references:

- Garmin Daily Suggested Workouts — explicit next action;
- Nike Run Club — concise and encouraging coaching language;
- Strava activity context — relevant facts without clinical-dashboard density.

These are behavioral references, not permission to copy another product's visual system. Race-mode
neon must not surround safety, health, privacy, or subscription guidance.

## 5. Technical scope

Deliver a production-ready native Android interaction flow plus the required shared server/API
contract.

Expected implementation surfaces:

- `src/lib/coach/schemas.ts`;
- `src/lib/coach/openai.ts`;
- `src/lib/coach/safety.ts`;
- `src/lib/coach/service.ts`;
- `src/lib/api/v1/coach.ts`;
- native network DTOs;
- `ConversationViewModel.kt`;
- `ConversationScreen.kt`;
- native EN/FR/AR string resources;
- focused server, contract, native presentation, and device tests.

Out of scope:

- website Coach UI;
- Capacitor;
- proactive notifications and scheduled check-ins;
- new durable Coach-memory categories;
- coaching-style preferences;
- automatic plan mutation;
- free clarification quota or new billing rules;
- a database migration unless implementation proves one is unavoidable.

New response fields should remain inside the existing `CoachInteraction.response` JSON where
possible.

## 6. Additive response contract

Extend the structured response additively:

```text
responseMode:
  ANSWER | CLARIFY

summary:
  existing direct answer

nextAction:
  short recommendation text or null

quickReplies:
  0–4 short runner-facing options

usedSignalKeys:
  closed provenance-key list

missingSignalKeys:
  closed missing-context-key list

followUpQuestion:
  existing optional question
```

Retain the current fields during compatibility rollout:

- `progressAssessment`;
- `positiveSignals`;
- `warningSignals`;
- `recoveryAdvice`;
- `usedSignals`;
- `dataGaps`.

Contract rules:

- `summary` answers the question first.
- `nextAction` recommends an action but never mutates the plan.
- `CLARIFY` contains one concise question and two to four options.
- Quick replies contain text only: no URLs, routes, commands, or mutation identifiers.
- Safety remains a separate, deterministic server object.
- Unknown provenance keys are discarded rather than rendered raw.
- New fields have safe defaults so older native builds remain compatible.
- Model-generated strings are never treated as executable instructions.

## 7. Response hierarchy

Render a completed response in this order:

1. safety notice when applicable;
2. direct answer;
3. **What to do now**;
4. clarification or follow-up options;
5. expandable supporting details;
6. **Why this advice?**;
7. repair actions;
8. read-aloud action.

Always visible:

- urgent/BLOCKED guidance;
- CAUTION guidance;
- direct answer;
- next action;
- clarification question.

Eligible for progressive disclosure:

- progress assessment;
- positive signals;
- non-critical recovery detail;
- data limitations;
- provenance.

Warnings must never be hidden in a collapsed section. Do not silently truncate model content. Use a
soft prompt budget of roughly one to three sentences for the summary and place supporting content in
secondary structured fields.

## 8. Interaction model

### 8.1 Ordinary answer

The runner sees:

- the direct answer;
- one recommended next step;
- optional **Show details**;
- optional **Why this advice?**;
- repair controls.

### 8.2 Clarification

Ambiguous questions should receive a concise clarification instead of a guess or refusal.

Example:

```text
العيا جاك بعد الجري ولا راكي حاسة بيه طول النهار؟
```

Possible options:

- `بعد الجري`;
- `ما رقدتش مليح`;
- `راني مريضة`;
- `كاين ألم ولا دوخة`.

Selecting an option fills the composer. It does not send automatically. This preserves quota
transparency and lets the runner edit the wording before creating another interaction.

### 8.3 Not what I meant

Offer this for ordinary completed answers and non-medical refusals.

Behavior:

1. keep the previous question visible;
2. focus the composer;
3. prefill a short localized repair lead such as `قصدي…`;
4. make no API call;
5. spend no quota until the runner explicitly taps Send;
6. create a new request ID only when the corrected message is submitted.

Do not show this action on urgent BLOCKED guidance because it may encourage rephrasing around the
safety gate.

### 8.4 Quick replies

- Show two to four maximum.
- Use minimum 44dp touch targets.
- Wrap instead of clipping.
- Follow RTL layout.
- Use the Coach language for generated reply text.
- Use the app language for fixed control labels.
- Insert into the composer without sending.

### 8.5 Human-readable provenance

Never display raw values such as:

```text
goal · active plan · consistency · missing environment data
```

Use closed keys and localized UI copy, for example:

```text
هاد النصيحة مبنية على هدفك، برنامجك الحالي، والمواظبة تاعك.
```

Initial provenance vocabulary:

```text
GOAL
ACTIVE_PLAN
RECENT_RUNS
PLAN_ADHERENCE
CONSISTENCY
SLEEP
WEATHER
ANALYSED_RUN
RUNNER_QUESTION
HEALTH_CONTEXT
SAFETY_DECISION
COACH_MEMORY
```

Do not expose a condition name, health note, raw runner text, or underlying value through
provenance.

## 9. Safety and refusal states

### 9.1 Off-topic

- Informational treatment.
- Warm redirect with example running questions.
- Composer remains available.
- No medical language.
- No provider call or quota consumption.

### 9.2 Ambiguous input with possible safety relevance

- Run deterministic urgent detection first.
- If no urgent match exists, the Coach may clarify.
- Conditional guidance must not imply medical clearance.
- Never change the plan automatically.

### 9.3 CAUTION

- Warning treatment.
- A direct answer may remain available.
- Conservative guidance remains expanded.
- Provenance may name a generic safety basis but never reveal private health text.

### 9.4 BLOCKED

- Highest visual and semantic prominence.
- Reviewed urgent action appears first.
- No training advice.
- No **Not what I meant** action.
- No retry language.
- No provider call or quota increment.
- TalkBack announces the urgent state before the body.

An urgent red-flag block also creates a persistent **exercise hold** inside the existing
`CoachInteraction.safety` JSON. It is shown on the Coach overview, conversation, plan, and Runs
overview. The app and those screens remain reachable, but availability is never presented as
permission to train. The hold:

- repeats the stop-exercise and emergency guidance;
- does not store a second copy of the symptom text;
- survives app restarts and account switches without crossing accounts;
- is not removed by dismissing or acknowledging the message;
- clears only after the runner explicitly confirms that a healthcare professional assessed them
  and cleared their return to exercise;
- clears every unresolved hold for that runner while retaining the original blocked interactions
  and safety audit trail.

## 10. Required UI states

The implementation must handle:

- first conversation/empty state;
- loading history;
- generating response;
- ordinary completed answer;
- clarification response;
- CAUTION response;
- urgent BLOCKED response;
- persistent exercise hold and medical-clearance confirmation;
- off-topic refusal;
- consent required;
- subscription required;
- daily limit reached;
- offline before Send;
- connection loss after the server may have completed;
- failed response with retained request ID;
- legacy responses without new fields;
- mixed Coach/app language;
- Arabic RTL;
- large text and narrow screens;
- on-device TTS active, stopped, and unavailable.

Generation should use truthful state copy such as **Checking your plan and recent runs…**, not
simulated typing theatrics.

## 11. Native architecture

Keep network/domain decisions out of the Composable where practical. Introduce a pure mapper:

```text
CoachMessageDto
    ↓
CoachMessagePresentation
```

The presentation model resolves:

- message kind;
- safety prominence;
- visible summary;
- next action;
- expandable sections;
- quick replies;
- repair availability;
- provenance keys;
- fallback copy.

Unit-test this mapper without Compose instrumentation. This prevents the F2/F3 state decision from
remaining an untested `when` block inside `ConversationScreen.kt`.

`ConversationViewModel` should own:

- selected quick-reply draft;
- repair draft;
- expanded-state IDs where restoration matters;
- retained request ID;
- pending question;
- send/retry lifecycle.

The server remains authoritative for the persisted transcript.

## 12. Localization and bidi

- Model-authored response text follows the selected Coach language.
- Fixed controls follow the Android app locale.
- Provenance keys use native string resources.
- Every model-authored field uses first-strong bidi isolation.
- Runner bubbles isolate mixed-language content as well.
- Raw `BASELINE`, `BEGINNER`, `Recovery`, `cadence`, signal keys, and enum values never reach UI.
- Arabic runner-facing copy is Algerian Darija-oriented, not translated MSA.
- French copy uses natural product French.
- Western-digit behavior remains consistent with the current native product decision.
- Validate EN, FR, and AR independently; key parity alone is not language-quality evidence.

## 13. Accessibility

- All actions are at least 44dp.
- Safety severity is announced semantically and never encoded by color alone.
- Quick replies have complete TalkBack labels.
- Expand/collapse controls announce their current state.
- Generating uses a polite live region.
- Urgent guidance uses an assertive announcement once, without repeated announcements on recomposition.
- Focus moves predictably when clarification or repair focuses the composer.
- TalkBack order follows the visible hierarchy.
- Support at least 1.3× font scale without clipping or horizontal scrolling.
- TTS reads safety, the answer, and the next action; it omits provenance keys and control labels.

## 14. Privacy and quota rules

- Do not add new health information to durable Coach memory.
- Do not send raw questions or replies to analytics.
- Provenance exposes categories, never sensitive values.
- Quick replies and repair text remain local until explicit Send.
- Do not auto-send or make a background provider call.
- Do not mutate the training plan silently.
- Preserve current request idempotency.
- A clarification currently counts as an ordinary interaction; changing that requires a separate
  product and quota decision.
- Retrying an uncertain request reuses its original request ID.

## 15. Implementation slices

### Slice A — stabilize the baseline

- Finish F3–F7.
- Restore Coach compilation.
- Correct deterministic urgent wording.
- Correct authoritative Darija refusal copy.
- Add the F2 presentation-matrix tests.
- Verify both block kinds on the physical phone.

### Slice B — additive response contract

- Add `responseMode`, `nextAction`, `quickReplies`, and provenance keys.
- Update the model schema and structured-output prompt.
- Map the new fields through `/api/v1`.
- Preserve compatibility defaults.
- Add server and API contract tests.

### Slice C — compact native response

- Introduce `CoachMessagePresentation`.
- Rebuild `CoachReplyCard` around the answer-first hierarchy.
- Keep safety guidance expanded.
- Add progressive disclosure.
- Apply bidi isolation to every dynamic field.

### Slice D — clarification and repair

- Render quick replies.
- Insert selected replies into the composer without sending.
- Add **Not what I meant**.
- Preserve request and quota semantics.
- Verify keyboard, focus, rotation, and process recreation.

### Slice E — provenance

- Replace free-form `usedSignals` rendering with controlled keys.
- Add localized advice-basis copy.
- Add human-readable missing-context explanations.
- Confirm that raw health values and enums cannot render.

### Slice F — acceptance

- Run focused server, unit, and contract suites.
- Run native compilation, unit tests, and lint.
- Verify EN/FR/AR key parity.
- Re-run physical-device P09/P10 sentinels.
- Verify RTL, mixed-language content, and large text.
- Verify TalkBack safety order.
- Verify light, dark, and race themes.
- Reconcile cost, quota, and provider-call evidence.

## 16. Acceptance criteria

The first release is acceptable when:

- an ordinary response communicates its recommendation before secondary detail;
- Darija and arabizi recovery questions reach coaching;
- ambiguous fatigue produces conditional guidance or clarification rather than refusal;
- quick replies and repair never auto-send;
- no raw technical provenance or enum text appears;
- off-topic and urgent blocks remain visibly and semantically distinct;
- BLOCKED is more prominent than CAUTION;
- urgent guidance uses the reviewed safety copy;
- warnings never disappear when details are collapsed;
- mixed-language punctuation remains correct in RTL;
- deterministic blocks consume no provider call or Coach quota;
- retry cannot duplicate a paid interaction;
- no new health-memory or analytics exposure is introduced;
- the physical P09/P10 sentinel passes twice on clean fixtures;
- no unresolved P0 or P1 finding remains.

No visual-direction probe is required for this work because it refines the existing approved Coach
surface and ZidRun design system rather than introducing a new visual language.
