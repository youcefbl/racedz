# 2026-11-17 — M21 run flow, mid-run coach, run detail, history (EN + AR)

Galaxy M21 (Android 12) over wireless debugging. `.debug` build 30 (branch `fix/runs-save-without-gps`
at `a24a60d` + a debug-only fake-GPS receiver) against the **local** server (`npm run dev`, local DB,
demo account `runner@example.com`). No production data touched. Screenshots (`*.png`, 1080×2340) are
in this folder and are not committed (see `../README.md`).

Fake GPS: scripted 1 Hz fixes with speed, bearing and altitude, sent through the debug build's
`MockFixReceiver` (`app/src/debug`). Cannot fake: step counter (cadence is "—" throughout), heart rate,
voice audio.

## What was run

| # | Scenario | Truth | Recorded | Verdict |
|---|---|---|---|---|
| A | EN, free run 10 km/h with a 25 m hill, a 40 s stop, a lap, a coach question | 1.000 km, 360 s moving | live 0.99 km / 6:00 clock; saved 0.993 km, moving 352 s, KEPT by server | ✅ accurate |
| B | AR, guided Intervals (10 min warm-up → 400 m reps), coach question in Arabizi | ≈1.75 km at 10:22 | 1.75 km at 10:22, step change to "Effort 1/6 · 400 m" at 10:00, saved 1.78 km | ✅ accurate |

Also checked: auto-pause during the stop (03→10), lap mark ("Lap 1 · 4:57", 11), auto-pause route
segments in the saved route, coach question linked to the saved run, history search (matches notes),
Run/All filters, Arabic RTL on start, live, summary, detail and history.

## Findings

### Data / logic

1. **Rides count as personal bests.** Runs home shows *Best pace 2:12/km*, which is the ride "SIM sport
   ride" (01, 19, 47). Rides must not feed running records.
2. **Elevation shows three different numbers for one run.** Run A: live and summary +21 m (GPS), detail
   chart "Gain 17 m", stored `elevationGainM` 5 m (DEM + smoothing); true climb 25 m. Run B: live +0 m,
   detail "الصعود ٤٢ م" (14, 17, 18-2, 40, 44).
3. **Calories disappear on save.** Summary shows 93 kcal (phone estimate); the saved run has
   `calories = NULL` (no weight on the goal), so the detail page has none (14 vs 17).
4. **Run detail drops moving time and calories** that the summary showed; detail only has distance,
   time and pace (17, 18-*).
5. **History and Runs home disagree on totals.** History "64 runs · 526.02 km" vs Personal bests
   "Total distance 524.01 km" (20 vs 19); neither says what it includes (rides, walks, excluded runs).
6. **"Analyze run" cannot analyse a run the runner asked the coach about mid-run.**
   `canAnalyseRun` hides the offer whenever any message is linked to the run, and the mid-run
   question is. Tapping "Analyze run" just opens the chat (24–26); no POST_RUN analysis was created.
7. **Mid-run coach is offered, then refused for consent.** Without a current health-data consent the
   sheet answers "Open your goal and save it to consent…" — impossible mid-run (05–07). Check consent
   before showing "Ask your coach", or offer the consent in the sheet.
8. **Coach replies in the goal's language, not the app's.** English app + English question → Darija
   answer, because the goal was created with `preferredLocale = ar` (09).
9. **Coach is told the average pace as the current pace.** It answered "current ≈5:52, average 5:52"
   while the runner was on the hill at ≈6:40/km (09).
10. **Coach writes Eastern Arabic digits** ("٩٣ ثانية") while the app writes Western digits in Arabic
    (36).

### UI

11. **The runner's question disappears from the mid-run coach sheet** once answered; only the reply is
    shown (09). The full chat (25) does show it.
12. **Ride shown as pace outside the record flow.** Latest-run card and history row show the ride as
    "2:12/km" (01, 20); live and summary already use km/h.
13. **Pace chart is too coarse on short runs.** ~4 points for 1 km (250 m window) draws a sharp V
    that looks like a glitch (18-2, 45).
14. **Elevation chart is spiky** (DEM sampled to nearest point gives square steps and 1-sample spikes)
    (18-1, 44).
15. **Live map opens at city scale**: a 1 km loop is a small shape mid-screen (03, 11). Street-level
    zoom expected while recording.
16. **Map framing is tight**: on summary and detail the route touches the top/right edge and the
    full-screen button sits on the route corner (14, 17).

### Arabic / RTL

17. **Split delta sign on the wrong side**: "0:12-" instead of "-0:12" (43).
18. **Elevation header mixes digit systems and units**: gain "٤٢ م", loss "m 42"; chart axis "m 269"
    (44).
19. **"This month" fraction reversed**: "350,0 / 11,8" instead of "11,8 / 350,0" (47).
20. **Digit systems mixed**: history header "٦٥ جَريات · 527,80 كم" (48); also "65 جَريات" should be
    "65 جَرية" after 11.
21. **Latin units next to Arabic ones**: pace "/km" and elevation "+0 m" beside "كم" (33, 38, 40) —
    known follow-up, still present.
22. **Glossary drift**: "دروك" on the intervals step control vs "ضرك" everywhere else (32).

### Working well

- Distance, moving time, auto-pause, laps and guided step timing were accurate in both runs.
- Start screen: GPS bars and "GPS is ready" hint, stable layout, weather placed on the fix (02, 31).
- Arabizi question understood; answer in Darija (36).
- Route thumbnails show pause gaps (20, "SIM recovery crash").
- History search and activity filters behave correctly.

## Screenshot index

| Files | Screen |
|---|---|
| 01, 01b, 19 | Runs home (EN) |
| 02, 02b, 02c | Start screen (EN) |
| 03, 10, 11, 12 | Recording (EN): 45 s, after stop, lap, end |
| 04–09 | Mid-run coach sheet (EN): open, typed, consent refusal, answer |
| 13 | Finish confirmation |
| 14, 15 | Summary (EN) |
| 17, 18-1, 18-2 | Run detail (EN) |
| 20–23 | History (EN): list, scrolled, Run filter, search "coach" |
| 24–26 | Analyze run → coach chat |
| 30, 47 | Runs home (AR) |
| 31, 32 | Start screen (AR), intervals structure |
| 33, 37, 38 | Recording guided (AR): warm-up, 5 min, step change |
| 34–36 | Mid-run coach (AR): sheet, Arabizi question, answer |
| 39–41 | Finish + summary (AR) |
| 43–45 | Run detail (AR) |
| 48 | History (AR) |

## After the fixes (same evening, `.debug` build 36, `after-fix/` screenshots)

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Rides in personal bests | Fixed: bests count valid RUN/TRAIL only, best pace needs ≥ 1 km (as the server) | f03 (best pace 5:00/km), f20 |
| 2 | Three elevation numbers | Fixed for the saved run: detail header shows the stored gain and a loss measured the same way (new `elevationLossM`); Highlights shows the stored gain. The live/summary figure is still the phone's pre-save estimate | f08 ("Gain 5 m · Loss 5 m"), f10 |
| 3 | Calories vanish on save | Fixed: server falls back to the same 70 kg estimate the phone shows | DB: 93 kcal saved = summary 93 |
| 4 | Detail drops moving time / calories | Fixed: second Highlights row (Moving, Elevation, Calories) | f10 |
| 5 | Totals disagree | Fixed by naming them: history "N activities · X km" (everything listed), Runs "Running distance" (bests) | f02, f03, f21 |
| 6 | Analyze run after a mid-run question | Fixed: only a POST_RUN review hides the offer | f11, f12 |
| 7 | Mid-run consent refusal | Fixed: overview reports `healthConsentActive`; the sheet explains instead of offering a composer | f28 |
| 8 | Reply in the goal's language | Fixed: non-Arabic questions follow the app's language (`appLocale`); voice picked per reply | f05 |
| 9 | Average given as current pace | Fixed in the prompt: null current pace = say so | f05 ("you're auto-paused, so there isn't a current pace reading") |
| 10 | Eastern digits from the coach | Fixed in the prompt | f05 ("6:18/كم") |
| 11 | Question disappears in sheet | Fixed | f04, f05 |
| 12 | Ride shown as pace in lists | Fixed: km/h on the latest card, history rows and detail header | f02 ("27.3 km/h") |
| 13 | Coarse pace chart | Fixed: window = distance/20 (50–250 m) | f09 |
| 14 | Spiky elevation chart | Fixed: DEM heights interpolated between samples (new runs), profile median + moving average (all runs) | f08 |
| 15 | Live map at city scale | Default zoom 16 → 17. Root cause noted, not fixed: tiles are drawn at 256 physical px, so labels are tiny on dense screens | — |
| 16 | Tight map framing | Fit margin 85 % → 72 % (static), 75 % (interactive) | f22 |
| 17 | Split delta sign (AR) | Fixed (isolated) | f22 ("-0:01") |
| 18 | Elevation digits/units (AR) | Fixed | f26 ("الصعود 5 م", axis "269 م") |
| 19 | Month fraction reversed (AR) | Fixed (isolated) | f24 ("10,7 / 350,0") |
| 20 | Mixed digit systems (AR) | Fixed at the root: Arabic is pinned to `ar-DZ` (Western digits for every `%d`); history count grammar fixed | f21 ("66 نشاط · 528,79 كم") |
| 21 | Latin units in Arabic | Fixed: "كم", "م", "كم/س", number-then-unit order for RTL readers | f25–f27 |
| 22 | "دروك" vs "ضرك" | Fixed, and added to the Darija drift gate | i18n gate |

Found while verifying, also fixed: "Am I going too fast?" was refused as off-topic (mid-run questions
now skip the topic gate; speed words added), and the new Highlights row first drew over the old one.
