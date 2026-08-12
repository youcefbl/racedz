/**
 * `usedSignals` and `dataGaps` reach the runner in the runner's language (COACH-F4, COACH-F6).
 *
 * Field test 20260812-01 showed an Arabic reply whose "based on" footer read
 * `runner question · goal · active plan · consistency` in English, and — in the same run, same
 * account — one reply with Arabic gaps and another with English ones. Both fields are
 * model-authored, so asking the model to translate them is what produced the inconsistency.
 *
 * The contract is now: the model emits a closed English vocabulary, the server maps it. This
 * asserts the mapping, and asserts the fallback, because a model that invents a value must degrade
 * to English rather than to a blank line.
 *
 *   npm run test:coach-signal-i18n
 */
import { enforceCoachSafety } from "../src/lib/coach/safety";
import type { CoachResponse } from "../src/lib/coach/schemas";
import type { CoachSafetyDecision } from "../src/lib/coach/safety";

let passed = 0;
let failed = 0;
const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label} — ${detail}`);
  if (cond) passed += 1;
  else failed += 1;
};

const clearDecision = () =>
  ({ level: "CLEAR", reasons: [] as string[], requiresProfessionalAdvice: false }) as CoachSafetyDecision;

function reply(usedSignals: string[], dataGaps: string[]): CoachResponse {
  return {
    summary: "s",
    progressAssessment: null,
    positiveSignals: [],
    warningSignals: [],
    nextWorkout: null,
    upcomingWorkouts: [],
    recoveryAdvice: [],
    requiresProfessionalAdvice: false,
    usedSignals,
    dataGaps,
    followUpQuestion: null,
    memoryCandidates: []
  } as unknown as CoachResponse;
}

const run = (signals: string[], gaps: string[], locale: "en" | "fr" | "ar") =>
  enforceCoachSafety(reply(signals, gaps), clearDecision(), [], locale);

// ---- The exact footer from the field test --------------------------------------------------------
const FOOTER = ["runner question", "goal", "active plan", "consistency"];

const ar = run(FOOTER, ["no recent runs", "no sleep logged"], "ar");
check(
  "the Arabic footer carries no English",
  ar.usedSignals.every((s) => !/[a-z]/i.test(s)),
  ar.usedSignals.join(" · ")
);
check(
  "Arabic gaps are Arabic",
  ar.dataGaps.every((g) => !/[a-z]/i.test(g)),
  ar.dataGaps.join(" · ")
);

const fr = run(FOOTER, ["no recent runs"], "fr");
check("the French footer is French", fr.usedSignals.includes("objectif"), fr.usedSignals.join(" · "));
check("French gaps are French", fr.dataGaps.includes("aucune sortie récente"), fr.dataGaps.join(" · "));

// ---- English is untouched -------------------------------------------------------------------------
const en = run(FOOTER, ["no recent runs"], "en");
check("English passes through unchanged", en.usedSignals.join("|") === FOOTER.join("|"), en.usedSignals.join(" · "));

// ---- Unknown values degrade to English, never to nothing --------------------------------------------
// The whole point of a fallback: a model that invents a signal must not blank the footer.
const odd = run(["goal", "phase of the moon"], ["no telemetry uplink"], "ar");
check(
  "an unknown signal survives as-is alongside a translated one",
  odd.usedSignals.length === 2 && odd.usedSignals.includes("phase of the moon") && odd.usedSignals.includes("الهدف"),
  odd.usedSignals.join(" · ")
);
check(
  "an unknown gap survives as-is",
  odd.dataGaps.length === 1 && odd.dataGaps[0] === "no telemetry uplink",
  odd.dataGaps.join(" · ")
);

// ---- Case and spacing from the model must not break the lookup --------------------------------------
const messy = run(["  Goal ", "ACTIVE PLAN"], ["  No Recent Runs  "], "ar");
check(
  "lookup is tolerant of case and padding",
  messy.usedSignals.every((s) => !/[a-z]/i.test(s)) && !/[a-z]/i.test(messy.dataGaps[0]),
  `${messy.usedSignals.join(" · ")} | ${messy.dataGaps.join(" · ")}`
);

// ---- Every vocabulary value the prompt allows must actually be mapped --------------------------------
// A key in the prompt with no entry here would reach an Arabic runner in English — the original bug.
const PROMPT_SIGNALS = [
  "goal", "active plan", "recent runs", "recent pace", "adherence", "consistency",
  "sleep", "weather", "analysed run", "chronic condition", "runner question",
  "safety decision", "coach memory"
];
const PROMPT_GAPS = [
  "no recent runs", "no recent pace", "no sleep logged", "no target race",
  "no weather data", "no heart-condition details", "no symptom details", "no injury details"
];
for (const locale of ["fr", "ar"] as const) {
  const all = run(PROMPT_SIGNALS, PROMPT_GAPS, locale);
  const untranslatedSignals = all.usedSignals.filter((s, i) => s === PROMPT_SIGNALS[i]);
  const untranslatedGaps = all.dataGaps.filter((g, i) => g === PROMPT_GAPS[i]);
  check(
    `every prompt-allowed signal is mapped in ${locale}`,
    untranslatedSignals.length === 0,
    untranslatedSignals.length ? `missing: ${untranslatedSignals.join(", ")}` : "all mapped"
  );
  check(
    `every prompt-allowed gap is mapped in ${locale}`,
    untranslatedGaps.length === 0,
    untranslatedGaps.length ? `missing: ${untranslatedGaps.join(", ")}` : "all mapped"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
