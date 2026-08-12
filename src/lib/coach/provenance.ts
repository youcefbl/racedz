/**
 * The closed provenance vocabulary (implementation brief §8.5).
 *
 * `usedSignals` and `dataGaps` are model-authored, and a prompt instruction is not a contract: the
 * provider can and does return values that were never on the list. The first pass at COACH-F4/F6
 * translated a known set and let anything else through unchanged, which meant an unlisted value
 * still reached an Arabic runner in English — the bug it was meant to close.
 *
 * So the vocabulary is closed here instead. Model output is normalised to a key, and anything that
 * does not resolve is DISCARDED rather than rendered raw (brief: "Unknown provenance keys are
 * discarded rather than rendered raw"). Dropping a chip costs the runner a line of provenance;
 * rendering an unmapped English string costs them the sentence.
 *
 * Two rules from the brief shape the key list itself:
 *   - provenance must never expose a condition name, health note, or raw runner text — hence the
 *     deliberately unspecific `HEALTH_CONTEXT` rather than "chronic condition", and
 *     `NO_HEALTH_DETAILS` rather than "no heart-condition details";
 *   - the keys are UPPER_SNAKE so the same vocabulary can move to the client unchanged when
 *     provenance becomes localised copy on the device.
 */

export const PROVENANCE_KEYS = [
  "GOAL",
  "ACTIVE_PLAN",
  "RECENT_RUNS",
  "PLAN_ADHERENCE",
  "CONSISTENCY",
  "SLEEP",
  "WEATHER",
  "ANALYSED_RUN",
  "RUNNER_QUESTION",
  "HEALTH_CONTEXT",
  "SAFETY_DECISION",
  "COACH_MEMORY"
] as const;

export const DATA_GAP_KEYS = [
  "NO_RECENT_RUNS",
  "NO_RECENT_PACE",
  "NO_SLEEP_LOGGED",
  "NO_TARGET_RACE",
  "NO_WEATHER_DATA",
  "NO_HEALTH_DETAILS",
  "NO_SYMPTOM_DETAILS",
  "NO_INJURY_DETAILS"
] as const;

export type ProvenanceKey = (typeof PROVENANCE_KEYS)[number];
export type DataGapKey = (typeof DATA_GAP_KEYS)[number];

type Copy = { en: string; fr: string; ar: string };

/** Arabic copy is darija, matching the coach's own voice rather than MSA. */
const PROVENANCE_COPY: Record<ProvenanceKey, Copy> = {
  GOAL: { en: "your goal", fr: "votre objectif", ar: "الهدف تاعك" },
  ACTIVE_PLAN: { en: "your current plan", fr: "votre plan actuel", ar: "البرنامج تاعك" },
  RECENT_RUNS: { en: "your recent runs", fr: "vos sorties récentes", ar: "الجريات الأخيرة تاعك" },
  PLAN_ADHERENCE: { en: "how closely you followed the plan", fr: "votre suivi du plan", ar: "شحال تبعت البرنامج" },
  CONSISTENCY: { en: "your consistency", fr: "votre régularité", ar: "المواظبة تاعك" },
  SLEEP: { en: "your sleep", fr: "votre sommeil", ar: "النوم تاعك" },
  WEATHER: { en: "the weather", fr: "la météo", ar: "المِيتيو" },
  ANALYSED_RUN: { en: "the run you asked about", fr: "la sortie analysée", ar: "الجَرية اللي سقسيت عليها" },
  RUNNER_QUESTION: { en: "your question", fr: "votre question", ar: "السؤال تاعك" },
  HEALTH_CONTEXT: { en: "the health details you shared", fr: "les informations de santé que vous avez partagées", ar: "المعلومات الصحية اللي شاركتها" },
  SAFETY_DECISION: { en: "a safety check", fr: "une vérification de sécurité", ar: "مراجعة السلامة" },
  COACH_MEMORY: { en: "what your coach remembers", fr: "ce que votre coach retient", ar: "واش فاكرو الكوتش" }
};

const DATA_GAP_COPY: Record<DataGapKey, Copy> = {
  NO_RECENT_RUNS: { en: "no recent runs", fr: "aucune sortie récente", ar: "ما كاش جريات أخيرة" },
  NO_RECENT_PACE: { en: "no recent pace", fr: "aucune allure récente", ar: "ما كاش ريتم جديد" },
  NO_SLEEP_LOGGED: { en: "no sleep logged", fr: "aucun sommeil enregistré", ar: "ما كاش نوم مسجّل" },
  NO_TARGET_RACE: { en: "no target race", fr: "aucune course cible", ar: "ما كاش سباق مستهدف" },
  NO_WEATHER_DATA: { en: "no weather data", fr: "aucune donnée météo", ar: "ما كاش معلومات على المِيتيو" },
  NO_HEALTH_DETAILS: { en: "no health details", fr: "aucune information de santé", ar: "ما كاش معلومات صحية" },
  NO_SYMPTOM_DETAILS: { en: "no symptom details", fr: "aucun détail sur les symptômes", ar: "ما كاش تفاصيل على الأعراض" },
  NO_INJURY_DETAILS: { en: "no injury details", fr: "aucun détail sur la blessure", ar: "ما كاش تفاصيل على الإصابة" }
};

/**
 * Phrasings the model produced before the vocabulary was closed, kept as aliases.
 *
 * Not politeness — these are what run 20260812-01 actually observed coming back, and a model that
 * has seen the old prompt shape will keep producing them. Mapping them is the difference between a
 * populated provenance line and an empty one during the changeover.
 */
const ALIASES: Record<string, ProvenanceKey | DataGapKey> = {
  "active plan": "ACTIVE_PLAN",
  adherence: "PLAN_ADHERENCE",
  "analysed run": "ANALYSED_RUN",
  "analyzed run": "ANALYSED_RUN",
  "chronic condition": "HEALTH_CONTEXT",
  "coach memory": "COACH_MEMORY",
  consistency: "CONSISTENCY",
  goal: "GOAL",
  "health context": "HEALTH_CONTEXT",
  "plan adherence": "PLAN_ADHERENCE",
  "recent activity": "RECENT_RUNS",
  "recent pace": "RECENT_RUNS",
  "recent runs": "RECENT_RUNS",
  "runner question": "RUNNER_QUESTION",
  "safety decision": "SAFETY_DECISION",
  sleep: "SLEEP",
  weather: "WEATHER",
  "weather from recent conversation": "WEATHER",
  // gaps
  "missing environment data": "NO_WEATHER_DATA",
  "no current symptom details": "NO_SYMPTOM_DETAILS",
  "no heart-condition details": "NO_HEALTH_DETAILS",
  "no heart-condition details or medical-clearance status": "NO_HEALTH_DETAILS",
  "no health details": "NO_HEALTH_DETAILS",
  "no injury details": "NO_INJURY_DETAILS",
  "no recent pace": "NO_RECENT_PACE",
  "no recent runs": "NO_RECENT_RUNS",
  "no recent runs or pace data": "NO_RECENT_RUNS",
  "no sleep logged": "NO_SLEEP_LOGGED",
  "no symptom details": "NO_SYMPTOM_DETAILS",
  "no target race": "NO_TARGET_RACE",
  "no weather data": "NO_WEATHER_DATA"
};

function canonical(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/**
 * The alias table, canonicalized on both sides.
 *
 * Built rather than written that way by hand because the two sides drifted: `canonical()` folds
 * hyphens to spaces, so a literal key like "no heart-condition details" could never match its own
 * canonicalized input. The health gap silently vanished instead of generalizing — caught by
 * test-coach-signal-i18n.
 */
const CANONICAL_ALIASES: Record<string, ProvenanceKey | DataGapKey> = Object.fromEntries(
  Object.entries(ALIASES).map(([phrase, key]) => [canonical(phrase), key])
);

/** Resolves model output to a key, or null when it is not in the vocabulary. */
export function resolveProvenanceKey(raw: string): ProvenanceKey | null {
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((PROVENANCE_KEYS as readonly string[]).includes(upper)) return upper as ProvenanceKey;
  const alias = CANONICAL_ALIASES[canonical(raw)];
  return alias && (PROVENANCE_KEYS as readonly string[]).includes(alias) ? (alias as ProvenanceKey) : null;
}

export function resolveDataGapKey(raw: string): DataGapKey | null {
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((DATA_GAP_KEYS as readonly string[]).includes(upper)) return upper as DataGapKey;
  const alias = CANONICAL_ALIASES[canonical(raw)];
  return alias && (DATA_GAP_KEYS as readonly string[]).includes(alias) ? (alias as DataGapKey) : null;
}

/** Closed, deduplicated provenance keys for API/client transport. Unknown model values vanish. */
export function provenanceKeys(values: readonly string[]): ProvenanceKey[] {
  return [...new Set(values.map(resolveProvenanceKey).filter((key): key is ProvenanceKey => key !== null))];
}

/** Closed, deduplicated missing-context keys for API/client transport. */
export function dataGapKeys(values: readonly string[]): DataGapKey[] {
  return [...new Set(values.map(resolveDataGapKey).filter((key): key is DataGapKey => key !== null))];
}

/**
 * Model output → localized copy, unknown values dropped and duplicates collapsed.
 *
 * Duplicates matter because the vocabulary is narrower than the phrasings feeding it: "recent pace"
 * and "recent runs" both resolve to RECENT_RUNS, and a provenance line reading "your recent runs ·
 * your recent runs" would look like a bug to the runner.
 */
export function localizeProvenance(values: readonly string[], locale: "en" | "fr" | "ar"): string[] {
  return provenanceKeys(values).map((key) => PROVENANCE_COPY[key][locale]);
}

export function localizeDataGaps(values: readonly string[], locale: "en" | "fr" | "ar"): string[] {
  return dataGapKeys(values).map((key) => DATA_GAP_COPY[key][locale]);
}
