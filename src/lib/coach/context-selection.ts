import type { CoachInteractionInput } from "@/lib/coach/schemas";

export type CoachIntent = "GENERAL" | "SCHEDULE" | "RECOVERY" | "NUTRITION" | "RUN_ANALYSIS";
/** Conservative multilingual routing; unfamiliar questions retain broad context, never safety-light. */
export function selectContextNeeds(input: Pick<CoachInteractionInput, "type" | "message">, followUpContext = "") {
  const text = `${input.message ?? ""} ${followUpContext}`;
  const schedule = /reschedul|swap|friday|monday|schedule|vendredi|décal|déplac|disponib|الجمعة|نبدل|الوقت|النهار|ghedwa/iu.test(text);
  const recovery = /sleep|tired|fatigue|recover|sore|pain|rest|sommeil|dormi|récup|douleur|عيان|عيا|نعاس|رقد|وجع|راحة|3ayan|3yit|nrta7/iu.test(text);
  const nutrition = /fuel|food|water|hydrat|nutrition|eat|calori|carb|manger|boire|غذا|ماكلة|ناكل|نشرب|ماء|makla/iu.test(text);
  const weather = /weather|heat|rain|humid|today|météo|chaleur|pluie|aujourd|طقس|سخانة|الحر|مطر|اليوم/iu.test(text);
  const intent: CoachIntent = input.type === "POST_RUN" ? "RUN_ANALYSIS" :
    nutrition ? "NUTRITION" : recovery ? "RECOVERY" : schedule ? "SCHEDULE" : "GENERAL";
  const broad = intent === "GENERAL" || input.type === "INITIAL_PLAN" || input.type === "WEEKLY_REVIEW";
  return {
    intent,
    sleep: broad || recovery || intent === "RUN_ANALYSIS",
    nutrition: broad || nutrition || intent === "RUN_ANALYSIS",
    forecast: input.type !== "POST_RUN" && (broad || weather),
    records: broad || intent === "RUN_ANALYSIS",
    recentRuns: broad || recovery || intent === "RUN_ANALYSIS",
    targetRace: broad || /race|course|سباق/iu.test(text)
  };
}
