# ZidRun Runs — Design Flow

This folder contains the high-fidelity visual reference for the Runs experience. The five screens
share one mobile-first system: strong outdoor readability, thumb-reachable actions, compact data,
and an energetic ZidRun identity that stays dependable when the runner is moving.

## Screen map

```text
Runs Overview
  ├─ Record a run / quick action ──> Create New Run
  ├─ View history ─────────────────> Runs List
  ├─ Latest run ───────────────────> Run Details
  └─ Personal records / achievements

Create New Run
  ├─ Choose Free / Guided / Planned
  ├─ Hold to begin ────────────────> During Run
  └─ Back ─────────────────────────> Runs Overview

During Run
  ├─ Pause ────────────────────────> Paused state / Resume
  ├─ Finish ───────────────────────> Pending Run Summary
  └─ Continue tracking

Pending Run Summary
  ├─ Save ─────────────────────────> Runs List, new run highlighted + opened
  └─ Discard ──────────────────────> Runs Overview / Runs List unchanged

Runs List
  ├─ Search, All, GPS, Manual, This month
  ├─ Tap a run ────────────────────> Run Details
  └─ Saved run feedback ───────────> Scroll to and highlight new item

Run Details
  ├─ Route, splits, elevation, pace
  ├─ Performance insight + recovery recommendation
  ├─ Analyze run ──────────────────> Coach analysis
  ├─ Export GPX
  ├─ Change privacy
  └─ Delete run ───────────────────> Confirmation, then return to list
```

## Visual references

| Screen | Purpose | Image |
|---|---|---|
| Runs Overview | Home for the Runs tab: momentum, latest activity, achievements, and entry points. | [01 — Runs Overview](images/01-runs-overview.png) |
| Create New Run | Choose a run type and begin with a press-and-hold interaction. | [02 — Create New Run](images/02-create-new-run.png) |
| During Run | Glanceable live tracking with distance, time, pace, route, and thumb controls. | [03 — During Run](images/03-during-run.png) |
| Runs List | Searchable and filterable run history with visual route summaries. | [04 — Runs List](images/04-runs-list.png) |
| Run Details | Post-run analysis, splits, charts, insights, recovery, and actions. | [05 — Run Details](images/05-run-details.png) |

## 1. Runs Overview

The Runs tab opens here. It should answer three questions immediately:

1. How am I progressing this week?
2. What was my latest run?
3. What can I do next?

Content order:

- Weekly distance and number of runs.
- Total time or current streak when available.
- Latest run card with route thumbnail, distance, pace, and duration.
- Personal records and achievement highlights.
- Primary actions: **Record a run**, **Log manually**, and **Import GPX**.
- Secondary link: **View history**.

The latest run card and the history link both open the same run detail/list journey. No run should
be hidden after saving; the newly saved item is inserted immediately and visually acknowledged.

## 2. Create New Run

The runner chooses one of three modes:

- **Free run** — ordinary GPS recording with no structured workout.
- **Guided workout** — audio cues and a structured warm-up/work/cool-down flow.
- **Planned session** — the next scheduled workout, when a plan exists.

The primary action is a press-and-hold footprint control. Holding for approximately 700 ms confirms
intent, provides visible progress, and prevents an accidental start while the runner is preparing.

Before starting, show readiness information when available:

- GPS ready / acquiring.
- Background recording readiness.
- Battery-saving status.
- Privacy state.
- Weather or temperature only when the data is available and useful.

The screen must remain usable with one hand. The selected mode stays visible while the runner holds
the action, and the control has a keyboard-accessible Enter/Space equivalent on web.

## 3. During Run

The live screen prioritizes quick glances over exploration.

Top priority:

- Recording or paused state.
- Distance.
- Elapsed time.
- Current pace and average pace.

Secondary information:

- GPS quality.
- Moving time.
- Elevation gain.
- Cadence and calories when available.
- Heart rate only when a supported sensor provides it; never invent or estimate a heart-rate value.

The route map appears only after a stable GPS route exists. During cold start or indoor movement,
show GPS-acquiring feedback instead of presenting a stale cached city or location.

Controls stay in the lower thumb zone:

- Pause / Resume is the primary action.
- Finish is visually separated as a deliberate ending action.
- A lock or screen-safe control may be added later if it is validated on the native device.

After Finish, the run enters a recoverable pending state. It is not uploaded or deleted until the
runner explicitly chooses **Save** or **Discard**.

## 4. Runs List

The Runs List is reachable from the Overview through **View history** and from the bottom navigation
when the Runs tab is already active.

Each row contains:

- Route thumbnail when GPS data exists.
- Date and optional title.
- Distance, pace, and duration.
- Useful secondary facts such as elevation, cadence, calories, or effort.
- Privacy and validity state when relevant.
- A clear Details action.

Filtering and search:

- Search by title, notes, or date.
- **All**.
- **GPS**.
- **Manual** (including imported/manual records).
- **This month**.

When a run is saved, the list updates without a page refresh, scrolls to the new row, opens its
details, and shows a short “Saved just now” state. If filters hide the new item, explain why rather
than making it appear missing.

## 5. Run Details

Run Details opens from a list row or the latest-run card. It is a progressive detail surface: the
first view gives a fast read, while deeper charts remain available without overwhelming the runner.

Content order:

1. Title, date, privacy state, route map.
2. Distance, duration, and average pace hero metrics.
3. Splits by kilometre with fastest/slowest indication.
4. Elevation profile with compact X/Y labels.
5. Pace profile with compact X/Y labels and average reference.
6. Performance insight based on the actual route and splits.
7. Recovery recommendation based on effort, fatigue, and pain signals.
8. Highlights: effort, heart rate when present, cadence, elevation, and calories.
9. Actions: Coach analysis, Export GPX, privacy, photos, and Delete.

The insight language must stay conservative. It can describe pacing consistency or a faster finish,
but it must not diagnose injury or present medical advice. High pain or suspicious/non-foot activity
should keep the safety warning visible.

## Interaction and animation direction

Motion is feedback, not decoration. All motion must have a reduced-motion alternative.

| Moment | Suggested motion | Reduced-motion behavior |
|---|---|---|
| Press-and-hold start | Footprint ring fills over ~700 ms with subtle haptic confirmation. | Instant progress state and no animated ring. |
| Start accepted | A short “ready → recording” transition; recording dot begins pulsing. | Immediate state swap. |
| GPS stabilizes | Map fades/draws in after the first trusted route points. | Map appears immediately once trusted. |
| Live tracking | Distance/time update with tabular numbers; avoid bouncing layout. | Same updates with no transitions. |
| Pause/resume | Recording indicator changes color and label; controls cross-fade. | Immediate label/color change. |
| Finish | Metrics settle into the pending summary; Save remains the clear action. | Immediate pending summary. |
| Save | New history row receives a short highlight ring, scrolls into view, and opens. | Row scrolls and receives a static focus/highlight state. |
| Run Details | Charts draw once when opened, then remain stable. | Charts render immediately. |
| Achievement | Small accent confirmation only after a real achievement is earned. | Static confirmation. |

Avoid continuous decorative animations, parallax, flashing neon, and movement that makes a live
metric harder to read outdoors.

## Theme modes

### Light mode

- White or near-white content surface.
- Charcoal text with strong AA contrast.
- Teal for primary actions and active states.
- Orange for emphasis, warnings, and finish-related actions.
- Maps and charts use pale surfaces with clear axes.

Best for planning, reviewing history, and post-run analysis in normal daylight.

### Dark mode

- Deep charcoal/navy surface with white primary text.
- Teal remains the active tracking color.
- Orange is reserved for warnings and deliberate destructive/finish actions.
- Route and chart lines remain bright enough for outdoor glances.
- Avoid low-contrast gray-on-charcoal labels.

Best for the live run screen, low-light use, and focused training.

### Race mode

- Keeps the same structure and information hierarchy as light/dark.
- Adds earned energy through lime, hot pink, and purple accents.
- Neon is limited to active progress, achievements, route emphasis, and race-day moments.
- Never use neon as the only indicator of status or as body text.
- Verify chart axes, focus rings, warnings, and disabled states separately.

Race mode changes atmosphere, not navigation or meaning.

## Languages and RTL

The complete flow supports:

- **English** — direct, compact product language.
- **French** — natural Algerian product French, not literal machine translation.
- **Arabic** — Algerian Darija for runner-facing copy, using Arabic script and natural local phrasing.

Arabic behavior:

- The layout direction is RTL, including cards, action groups, chart labels, and navigation.
- Icons that communicate direction mirror where appropriate; activity icons do not mirror.
- Distance, time, pace, and heart-rate values remain visually stable and easy to scan.
- Route geometry does not mirror; geographic data must remain geographically truthful.
- Search, text fields, textareas, and focus scrolling must work from the RTL edge.
- Buttons keep a minimum 44 px touch target even when Arabic labels become longer.

All three languages must be checked in all three modes. No screen is complete if the English layout
works but French wraps badly or Arabic clips, overflows, or loses the primary action.

## Accessibility baseline

- Minimum 44 px touch targets.
- Visible keyboard focus on every action.
- Screen-reader labels for route maps, charts, GPS state, recording state, and press-and-hold progress.
- Color is never the only signal for recording, pause, warning, privacy, or validity.
- Live values use tabular numerals and do not cause layout jumps.
- Error, pending-save, GPS-acquiring, and offline states use `role=status` or `role=alert` as appropriate.
- Respect `prefers-reduced-motion`.
- Test with high text size and narrow Android screens.

## Sample navigation acceptance

1. Open Runs and see the Overview.
2. Tap **Record a run** and choose Free, Guided, or Planned.
3. Hold the footprint control until recording starts.
4. Confirm live distance/time/pace and GPS behavior.
5. Pause, resume, then finish.
6. Verify the pending summary offers explicit Save and Discard.
7. Save and confirm the new row appears in the list without refresh.
8. Confirm the row opens Run Details with map, splits, charts, insight, and recovery guidance.
9. Return to Overview through the Runs navigation.
10. Repeat in light, dark, race, English, French, and Arabic RTL.
