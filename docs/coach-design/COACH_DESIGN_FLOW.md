# ZidRun Coach — Design Flow

This folder contains the high-fidelity visual direction for the Coach feature. It follows the same
design language as the Runs redesign: mobile-first layout, strong outdoor readability, thumb-friendly
actions, compact data, and earned athletic energy across light, dark, and race modes.

The Coach is a training companion, not a medical product. It should make the runner's next safe
decision obvious while keeping health context private and giving the runner control over what is
stored and used.

## Screens

| Screen | Purpose | Image |
|---|---|---|
| Coach Overview | Daily home for the current workout, progress, latest coach review, and next action. | [01 — Coach Overview](images/01-coach-overview-v2.png) |
| Goal Setup | Five-step setup for a goal, background, availability, health/safety context, and review. | [02 — Coach Goal Setup](images/02-coach-goal-setup-v2.png) |
| Weekly Plan | Weekly schedule with today's workout, completion states, and supportive plan actions. | [03 — Weekly Plan](images/03-weekly-plan-v2.png) |
| Coach Conversation | Post-run review and direct questions with text or voice input. | [04 — Coach Conversation](images/04-coach-conversation-v2.png) |
| Sleep & Recovery | Private recovery input that helps the Coach interpret training load. | [05 — Sleep & Recovery](images/05-sleep-recovery-v2.png) |

## Main navigation

```text
Coach entry
  ├─ No goal / missing required setup ─────> Goal Setup
  ├─ Trial or active subscription ─────────> Coach Overview
  └─ Subscription expired / unavailable ──> Coach Subscribe

Coach Overview
  ├─ Today's workout ──────────────────────> Weekly Plan
  ├─ Log this run ─────────────────────────> Runs / Create Run
  ├─ View plan ────────────────────────────> Weekly Plan
  ├─ Latest coach review ──────────────────> Coach Conversation
  ├─ Memory ───────────────────────────────> Coach Memory & Privacy
  ├─ Sleep ────────────────────────────────> Sleep & Recovery
  └─ Goal / language settings ─────────────> Edit Goal / Preferences

Weekly Plan
  ├─ Generate or review plan ──────────────> Plan generation state
  ├─ Today's workout ──────────────────────> Run logging
  ├─ Move ─────────────────────────────────> Day picker
  ├─ I can't today ────────────────────────> Supportive reason picker
  └─ Completed run ─────────────────────────> Run Details → Coach analysis

Runs / Run Details
  └─ Analyze run ──────────────────────────> Coach Conversation focused on that run

Coach Conversation
  ├─ Ask a question ──────────────────────> New Coach response
  ├─ Record a voice note ──────────────────> Transcription → Coach response
  └─ Back ─────────────────────────────────> Coach Overview
```

## 1. Coach Overview

The overview is the daily landing page. It should answer:

1. What should I do today?
2. How is my training going?
3. What did my Coach notice?

Content order:

- Goal chip, edit goal, Coach memory/privacy control, and language selector.
- Trial/subscription state when relevant, without interrupting an active session.
- **Today** hero with the next workout, target distance/time/intensity, instructions, and one clear
  action: **Log this run**.
- Weekly adherence summary such as completed vs planned sessions.
- Latest Coach review with positive signals and warnings kept short.
- One rotating Coach tip, never a wall of advice.
- Secondary access to Plan, Sleep, Runs, and Coach conversation.

If there is no active plan, the page acknowledges the runner's actual recent training and offers a
calm **Generate weekly plan** action. If there are no runs yet, the empty state teaches the next
step instead of showing an empty dashboard.

## 2. Goal Setup

Goal Setup is a focused five-step flow, not a long form:

1. **Goal** — 5K, 10K, half marathon, custom goal, target date/time.
2. **Background** — experience, years running, recent distance, longest recent run, recent result.
3. **Availability** — training days and preferred long-run day.
4. **Health & safety** — injury history, current limitations, chronic conditions, health notes, and
   explicit consent. The Coach explains that it provides training guidance, not diagnosis.
5. **Review** — show what will be used, what is optional, and confirm before creating the goal.

Interaction rules:

- Always show progress such as **Step 1 of 5**.
- Save progress locally during the flow without silently submitting health data.
- Keep Back and Continue in the lower thumb zone.
- Preserve entered values when validation fails.
- Make required fields clear and avoid account/email-style enumeration.
- After saving, return to Coach Overview with the first useful next action visible.

Editing a goal reuses the same structure with existing answers prefilled. Cancel returns without
changing the active plan.

## 3. Weekly Plan

The plan is a weekly rhythm, not a spreadsheet. Each day communicates its state clearly:

- Planned.
- Today.
- Completed.
- Completed differently than planned.
- Missed/skipped with an optional reason.
- Rest day.

The plan header contains:

- Date range.
- Active or draft state.
- Version when relevant.
- Plan summary in short, plain language.
- **Generate weekly plan** or **Review next week** action.

Today's workout is the most visually important row. It includes target distance, duration/intensity,
instructions, and **Log this run**. A planned workout should hand off into the Runs flow with the
workout already selected.

Supportive exception actions:

- **Move** opens a small day picker limited to safe plan dates.
- **I can't today** asks for a reason such as schedule, fatigue, pain/symptoms, weather, illness,
  travel, motivation, or other.
- A missed workout should never use shaming language.

The safety note remains available but quiet: plan dates, workout types, and distance ceilings are
enforced by ZidRun safety rules.

## 4. Coach Conversation

The conversation is a focused answer surface, not a generic chatbot inbox.

Entry points:

- Latest Coach review on Overview.
- **Analyze run** from Run Details.
- **Ask your coach** from the Coach tab.
- Weekly review or initial plan generation.

Post-run response order:

1. Context chip with the analyzed run.
2. Short summary.
3. Positive signals.
4. Warnings or caution signals.
5. Conservative next workout/recovery advice.
6. Optional follow-up question chips.

Input options:

- Text question.
- Voice note with visible recording/transcribing state.
- Send action that stays thumb reachable above the navigation area.

The response should be concise by default and expandable when the runner asks for detail. Advice
must stay within the product safety boundary and recommend professional assessment when the stored
safety signals require it.

## 5. Sleep & Recovery

Sleep is a supporting Coach surface. It should not compete with today's run.

Content order:

- Seven-night average.
- Compact seven-day trend.
- Last logged night.
- **Log sleep** action.
- Optional note or natural-language description.
- A small recovery context message explaining how the Coach may use the entry.
- **Private by default** reminder.

The flow supports hours, bed/wake times, or a short description. Parsing a description should show
the interpreted result for confirmation. Deleting or correcting a night must be easy.

## Coach Memory & privacy

Memory is a trust surface reached from the header, not a crowded primary tab. It should show:

- What the Coach remembers.
- Why each item exists: runner-stated, Coach-inferred, derived from training, or human Coach note.
- The ability to confirm, forget one item, export, or delete all memory.
- A clear statement that health, injury, and medical details are not stored in durable Coach memory.

The runner should never wonder whether a health note, precise route, or voice recording became a
permanent memory item.

## Subscription and access states

- During the free trial, show remaining time/usage as a calm inline banner.
- When the trial ends, explain what is locked and provide one direct subscription action.
- Keep training history and private data visible even when AI generation is unavailable.
- Payment and subscription screens use the same trustworthy light/dark/race design tokens, but avoid
  race-mode neon around financial actions.

## Motion direction

Motion communicates state and progress only. Every animation has a reduced-motion alternative.

| Moment | Suggested animation | Reduced-motion behavior |
|---|---|---|
| Coach opens | Today hero settles in with a short opacity/position transition. | Immediate render. |
| Goal setup progress | Progress indicator advances and the next step cross-fades. | Instant step change. |
| Generate plan | Replace the action with a calm progress state; do not use an indefinite spinner alone. | Static “Preparing…” state. |
| Today workout | A small active marker breathes slowly while the session is due. | Static active marker. |
| Complete workout | Checkmark draws once and the adherence count updates. | Static completed state. |
| Move/skip | Inline panel expands below the workout row. | Inline panel appears immediately. |
| Coach response | Response appears with a short reveal; never stagger long text line by line. | Immediate response. |
| Voice note | Recording level/status indicator updates without moving the composer. | Static recording state plus elapsed time. |
| Sleep trend | Bars draw once when the page opens. | Immediate chart. |
| Memory deletion | Confirmation state and removal acknowledgement. | Immediate state update after confirmation. |

Avoid confetti, constant pulsing, chatbot typing theatrics, and motion that competes with a workout
instruction or warning.

## Theme modes

### Light mode

- White content surface, charcoal text, teal primary action.
- Orange marks effort, next actions, and caution.
- Green is reserved for completed/adherence states.
- Charts use clear axes and light surfaces.

### Dark mode

- Deep charcoal/navy surface with white primary text.
- Teal marks the active workout and Coach actions.
- Orange and amber remain reserved for caution or emphasis.
- Keep long Coach text on a solid readable surface rather than decorative glass.

### Race mode

- Same navigation, hierarchy, and meaning as light/dark.
- Lime, hot pink, and purple add race-day energy to progress, achievements, and active states.
- Never use neon as body text or the only status signal.
- Subscription, health, privacy, and safety copy stays restrained and high contrast.

## Languages and RTL

The Coach supports:

- **English** — concise, direct training language.
- **French** — natural Algerian product French.
- **Arabic** — Algerian Darija for runner-facing guidance, using Arabic script.

Arabic/RTL requirements:

- Mirror layout direction for headers, cards, tabs, actions, forms, and Coach messages.
- Keep activity and Coach icons visually stable; mirror directional arrows where meaning requires it.
- Do not mirror geographic maps or route geometry.
- Keep numeric metrics, pace units, dates, and chart axes easy to scan.
- Support Arabic text expansion without clipping the primary action.
- Place the text composer and input focus behavior correctly at the RTL edge.
- Verify the five screens in all three modes and all three languages, not only English light mode.

## Accessibility baseline

- Minimum 44 px touch targets.
- Visible focus for keyboard and switch-control navigation.
- Screen-reader labels for progress, workout state, plan actions, charts, voice recording, and privacy.
- Never use color alone for complete, missed, active, caution, or subscription states.
- Keep live generation/recording states announced with appropriate status semantics.
- Support larger text, narrow screens, and one-handed use.
- Respect `prefers-reduced-motion`.
- Keep health/privacy copy readable at all font sizes.

## End-to-end acceptance flow

1. Open Coach with no goal and enter Goal Setup.
2. Complete the five steps in English, French, and Arabic Darija.
3. Confirm Coach Overview shows the correct goal and today's next action.
4. Generate or accept a weekly plan.
5. Log today's workout through the Runs flow.
6. Save the run and open its Run Details.
7. Tap Analyze run and land on the focused Coach Conversation response.
8. Ask a follow-up question by text and voice note.
9. Log sleep and confirm the private recovery context.
10. Move or skip one planned workout with a reason, then confirm the plan state updates.
11. Open Coach Memory, review provenance, and verify forget/export controls.
12. Repeat the primary flow in light, dark, race, English, French, and Arabic RTL.
