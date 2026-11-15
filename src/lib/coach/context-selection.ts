import type { CoachInteractionInput } from "@/lib/coach/schemas";

export type CoachIntent = "GENERAL" | "SCHEDULE" | "RECOVERY" | "NUTRITION" | "RUN_ANALYSIS";

// JavaScript's `\b` is ASCII-centric, so use Unicode letter/number boundaries for all supported
// languages. Stems are explicit inside each pattern; an unbounded `eat` must never match `beat`.
const bounded = (source: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, "iu");
const SCHEDULE = bounded("reschedul(?:e|ing)?|swap|friday|monday|schedule|vendredi|d[ée]cal(?:er|age)?|d[ée]plac(?:er|ement)?|disponib(?:le|ilit[ée])?|الجمعة|نبدل|الوقت|النهار|ghedwa");
const RECOVERY = bounded("sleep|slept|tired|fatigue|recover(?:y|ing)?|sore|pain|rest|sommeil|dormi|r[ée]cup(?:[ée]ration|[ée]rer)?|douleur|عيان|عيا|نعاس|رقد|وجع|راحة|3ayan|3yit|nrta7");
const NUTRITION = bounded("fuel(?:ing)?|food|water|hydrat(?:e|ion)?|nutrition|eat(?:ing)?|calori(?:e|es|que)?|carb(?:s)?|manger|boire|غذا|ماكلة|ناكل|نشرب|ماء|makla");
const WEATHER = bounded("weather|heat|rain(?:y|ing)?|humid(?:ity)?|today|m[ée]t[ée]o|chaleur|pluie|aujourd(?:'hui)?|طقس|سخانة|الحر|مطر|اليوم");
const RACE = bounded("race|races|course|سباق");

/** Conservative multilingual routing; unfamiliar questions retain broad context, never safety-light. */
export function selectContextNeeds(input: Pick<CoachInteractionInput, "type" | "message">, followUpContext = "") {
  const text = `${input.message ?? ""} ${followUpContext}`;
  const schedule = SCHEDULE.test(text);
  const recovery = RECOVERY.test(text);
  const nutrition = NUTRITION.test(text);
  const weather = WEATHER.test(text);
  const matchedNarrowIntents = [schedule, recovery, nutrition].filter(Boolean).length;
  const intent: CoachIntent = input.type === "POST_RUN" ? "RUN_ANALYSIS" :
    matchedNarrowIntents !== 1 ? "GENERAL" : nutrition ? "NUTRITION" : recovery ? "RECOVERY" : "SCHEDULE";
  const broad = intent === "GENERAL" || input.type === "INITIAL_PLAN" || input.type === "WEEKLY_REVIEW";
  return {
    intent,
    sleep: broad || recovery || intent === "RUN_ANALYSIS",
    nutrition: broad || nutrition || intent === "RUN_ANALYSIS",
    forecast: input.type !== "POST_RUN" && (broad || weather),
    records: broad || intent === "RUN_ANALYSIS",
    recentRuns: broad || recovery || intent === "RUN_ANALYSIS",
    targetRace: broad || RACE.test(text)
  };
}
