# NATRUN-06 visual proposal (2026-08-16) — asks for the owner

Mock: `index.html` in this folder (token-accurate; light/dark, race by token swap). Status and
progress live only in `EXECUTION_PLAN.md`; this file is the dated proposal record.

Already covered by approved references, so **not** asked here: the live-map position marker and the
cadence tile in the secondary row (`docs/runs-design/images/03-during-run.png`), the achievement
chip and the Share action slot on Run Details (`05-run-details.png`), the visibility row and the
edit sheet (built from existing components, delivered as NATRUN-06 (a)/(b)).

## Asks (yes / no / change)

1. **Best efforts card** on Run Details, below Splits: rows for 1 km / 5 km / 10 km with time and
   pace; rows the run is too short for read "—  Run shorter than N km" in muted text; a "PR" chip
   (primarySoft/primary, same chip as the achievement row) only when the server says so.
2. **Laps card** (manual laps) on the summary and on Run Details, same table treatment as Splits;
   Splits stay as they are. Requires the server to store laps (see contract below); if declined,
   laps show on the summary only and the detail card is omitted.
3. **During Run secondary row → Cadence · Elevation · Calories** (as in 03-during-run.png).
   Moving time leaves the live screen (it stays on the summary and detail). Cadence shows "—" until
   ≥60 s of steps and is announced to TalkBack once as "cadence unavailable", not on every tick.
4. **Lap control in the left thumb slot** (48 dp circle + label, primary tint), Pause pill in the
   middle, Finish on the right — the mock's left slot is the Lock, which is NATRUN-07.7; when the
   touch guard arrives it will need its own placement decision (proposal then: long-press on the
   status header).
5. **Recenter control**: 44 dp circular icon at the map's bottom-end corner, visible only after the
   runner pans; hidden while following.
6. **Countdown** (setting, off by default): full-bleed dark surface after the hold completes; one
   number in displayLarge inside a primary ring that empties per second; reduced motion shows the
   number only; 56 dp Cancel in the thumb zone; nothing recorded until zero.
7. **Share image**: route-only brand card 1080×1350 on the theme surface with the ZidRun logo
   variant, distance · time · pace, date; no tiles, no notes, no coordinates, no name.
   "Share image" takes the first slot of the actions row (Export GPX, Analyse follow).
8. **km/mi**: Account → Settings row using the existing menu-row + choice-chip pattern; no mock.

## Contract decisions proposed (server changes the native features require)

- **Best efforts + PR** — the phone can compute fastest 1/5/10 km from the route, but a PR is a
  comparison across the runner's other runs, which only the server can make authoritatively.
  Proposed: `GET /api/v1/runs/{id}` gains `bestEfforts: [{ distanceM, seconds, startIndex,
  isPersonalBest }]`, computed from the route (same helper both clients use, in
  `src/lib/coach/run-stats.ts`), only for `validity = VALID`, only when timestamps exist and the
  route's sampling gap is ≤ 30 s across the effort; PR = strictly faster than every other VALID run
  of the same user with an eligible effort. Ties do not earn a PR. Nothing is stored; computed on
  read like splits are.
- **Manual laps** — proposed: `RunnerRun.laps Json` (array of `{ atMeters, atSeconds }` boundaries,
  ≤ 100), accepted on create/PATCH by `runCreateSchema`/`runUpdateSchema`, returned on detail.
  Without it laps live only in the pending summary. Owner call.

## Recorded intent

- Colours, radii, type and spacing are the existing tokens; no new component vocabulary.
- All new tables use tabular numerals; every control ≥ 44 dp; RTL mirrors layout, never the map.
