/**
 * `usedSignals` and `dataGaps` reach the runner in the runner's language (COACH-F4, COACH-F6).
 *
 * Field test 20260812-01 showed an Arabic reply whose "based on" footer read
 * `runner question · goal · active plan · consistency` in English, and — in the same run, same
 * account — one reply with Arabic gaps and another with English ones. Both fields are
 * model-authored, so asking the model to translate them is what produced the inconsistency.
 *
 * The contract is a CLOSED vocabulary (brief §8.5): the model emits keys, the server maps them, and
 * anything not in the vocabulary is discarded rather than rendered raw.
 *
 * The first version of this file asserted the opposite — that unknown values pass through unchanged
 * — which made the test require the very behaviour the finding was about: a value the prompt never
 * listed still reaching an Arabic runner in English. A prompt instruction is not a contract; the
 * provider can return anything, so the boundary has to drop what it does not recognise.
 *
 *   npm run test:coach-signal-i18n
 */
import { enforceCoachSafety } from "../src/lib/coach/safety";
import type { CoachResponse } from "../src/lib/coach/schemas";
import type { CoachSafetyDecision } from "../src/lib/coach/safety";
import { DATA_GAP_KEYS, PROVENANCE_KEYS, dataGapKeys, provenanceKeys } from "../src/lib/coach/provenance";

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
    responseMode: "ANSWER",
    summary: "s",
    nextAction: null,
    quickReplies: [],
    progressAssessment: null,
    positiveSignals: [],
    warningSignals: [],
    nextWorkout: null,
    upcomingWorkouts: [],
    recoveryAdvice: [],
    requiresProfessionalAdvice: false,
    usedSignals,
    usedSignalKeys: [],
    dataGaps,
    missingSignalKeys: [],
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
const arHealth = run(["health context", "plan adherence", "analysed run"], [], "ar");
check(
  "Arabic provenance does not assume the runner's gender",
  !arHealth.usedSignals.some((signal) => /عطيتي|تبعتي|سقسيتي/.test(signal)),
  arHealth.usedSignals.join(" · ")
);
check(
  "Arabic gaps are Arabic",
  ar.dataGaps.every((g) => !/[a-z]/i.test(g)),
  ar.dataGaps.join(" · ")
);

const fr = run(FOOTER, ["no recent runs"], "fr");
check("the French footer is French", fr.usedSignals.includes("votre objectif"), fr.usedSignals.join(" · "));
check("French gaps are French", fr.dataGaps.includes("aucune sortie récente"), fr.dataGaps.join(" · "));

// ---- English is copy too, not the raw keys -----------------------------------------------------
const en = run(FOOTER, ["no recent runs"], "en");
check(
  "English renders readable copy, not the keys",
  en.usedSignals.includes("your goal") && !en.usedSignals.includes("GOAL"),
  en.usedSignals.join(" · ")
);

// ---- Unknown values are DISCARDED, never rendered raw ------------------------------------------
// The whole point of closing the vocabulary. Dropping a chip costs a line of provenance; rendering
// an unmapped English string in an Arabic reply costs the sentence.
const odd = run(["GOAL", "phase of the moon"], ["no telemetry uplink"], "ar");
check(
  "an unknown signal is dropped, the known one kept",
  odd.usedSignals.length === 1 && !/[a-z]/i.test(odd.usedSignals[0]),
  odd.usedSignals.join(" · ") || "(empty)"
);
check(
  "an unknown gap is dropped entirely",
  odd.dataGaps.length === 0,
  odd.dataGaps.join(" · ") || "(empty)"
);
check(
  "English output cannot contain an unmapped value either",
  run(["GOAL", "phase of the moon"], [], "en").usedSignals.length === 1,
  run(["GOAL", "phase of the moon"], [], "en").usedSignals.join(" · ")
);

// ---- Aliases from before the vocabulary closed still resolve --------------------------------------
// Observed in run 20260812-01; a model that saw the old prompt keeps emitting them.
const legacy = run(["runner question", "active plan", "chronic condition"], ["no heart-condition details"], "ar");
check(
  "legacy phrasings still resolve to keys",
  legacy.usedSignals.length === 3 && legacy.usedSignals.every((s) => !/[a-z]/i.test(s)),
  legacy.usedSignals.join(" · ")
);
check(
  "a health gap is generalized, never naming the condition",
  legacy.dataGaps.length === 1 && !/heart|قلب/i.test(legacy.dataGaps[0]),
  legacy.dataGaps.join(" · ")
);

// ---- Duplicates collapse ---------------------------------------------------------------------------
// "recent runs" and "recent pace" both resolve to RECENT_RUNS; repeating the copy looks like a bug.
check(
  "values collapsing to one key render once",
  run(["recent runs", "recent pace"], [], "ar").usedSignals.length === 1,
  run(["recent runs", "recent pace"], [], "ar").usedSignals.join(" · ")
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
// A key in the vocabulary with no copy would render as nothing at all, which is the failure mode
// the discard rule creates. Every key must survive in every locale.
for (const locale of ["en", "fr", "ar"] as const) {
  const signals = run([...PROVENANCE_KEYS], [], locale).usedSignals;
  check(
    `every provenance key renders in ${locale}`,
    signals.length === PROVENANCE_KEYS.length && signals.every((s) => s.trim().length > 0),
    `${signals.length}/${PROVENANCE_KEYS.length}`
  );
  const gaps = run([], [...DATA_GAP_KEYS], locale).dataGaps;
  check(
    `every data-gap key renders in ${locale}`,
    gaps.length === DATA_GAP_KEYS.length && gaps.every((g) => g.trim().length > 0),
    `${gaps.length}/${DATA_GAP_KEYS.length}`
  );
  if (locale !== "en") {
    check(
      `no key leaks Latin text in ${locale}`,
      locale === "fr" || signals.every((s) => !/[a-z]/i.test(s)),
      signals.filter((s) => /[a-z]/i.test(s)).join(" · ") || "none"
    );
  }
}

// ---- Stored replies must still resolve after the copy is rewritten ----------------------------------
// `enforceCoachSafety` localizes these fields BEFORE they are persisted, so a CoachInteraction row
// holds "الهدف تاعك", not `GOAL`. The native card resolves that stored prose back to a key and
// renders its own on-device label — so every time this copy is rewritten, the phrasings already in
// the database must keep resolving, or the whole "Why this advice?" block vanishes for the runner's
// entire history. Each generation of shipped copy is checked, in every language it shipped in.
const STORED_COPY: Array<{ generation: string; signals: string[]; gaps: string[] }> = [
  {
    generation: "gen1 (fa58dfc, short labels)",
    signals: ["objectif", "البرنامج الحالي", "الوتيرة الأخيرة", "sommeil", "سؤال العدّاء", "ذاكرة المدرب"],
    gaps: ["ما كاش تفاصيل على الحالة القلبية", "aucune allure récente"]
  },
  {
    generation: "gen2 (b6394aa, closed vocabulary)",
    signals: ["قدّاش تبعتي البرنامج", "الجرية اللي سقسيتي عليها", "المعلومات الصحية اللي عطيتيها", "الطقس"],
    gaps: ["ما كاش وتيرة أخيرة", "ما كاش معطيات الطقس"]
  },
  {
    generation: "gen3 (1eb0782, gender-neutral darija)",
    signals: ["شحال تبعت البرنامج", "الجَرية اللي سقسيت عليها", "المِيتيو", "votre suivi du plan", "your goal"],
    gaps: ["ما كاش ريتم جديد", "ما كاش معلومات على المِيتيو"]
  }
];

for (const { generation, signals, gaps } of STORED_COPY) {
  const resolvedSignals = provenanceKeys(signals);
  check(
    `stored provenance copy from ${generation} still resolves`,
    resolvedSignals.length === new Set(signals.map((s) => provenanceKeys([s])[0])).size &&
      signals.every((s) => provenanceKeys([s]).length === 1),
    signals.map((s) => `${s} → ${provenanceKeys([s])[0] ?? "DROPPED"}`).join(" · ")
  );
  check(
    `stored gap copy from ${generation} still resolves`,
    gaps.every((g) => dataGapKeys([g]).length === 1),
    gaps.map((g) => `${g} → ${dataGapKeys([g])[0] ?? "DROPPED"}`).join(" · ")
  );
}

// The index widens what resolves; it must not widen it to everything. Invented prose still drops,
// and a provenance phrase must not leak into the gap vocabulary or the reverse.
check(
  "invented prose is still discarded, in every language",
  provenanceKeys(["some signal the model made up", "الطقس تاع بكري", "une raison inventée"]).length === 0,
  "all dropped"
);
check(
  "a provenance phrase does not resolve as a data gap",
  dataGapKeys(["الطقس"]).length === 0 && provenanceKeys(["ما كاش جريات أخيرة"]).length === 0,
  "vocabularies stay separate"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
