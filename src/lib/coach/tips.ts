import "server-only";

import { getPrisma } from "@/lib/db";
import type { CoachLocale } from "@/components/coach/types";

// Matching + localization for DB-backed coach tips. A tip's `category` decides which
// runners see it; GENERAL tips show to everyone. Categories are derived from the
// runner's active RunnerGoal (experience, goal type, body metrics, injury history)
// with no extra input required. Tip text is stored per-language (textEn/textFr/textAr).

export type TipCategory =
  | "GENERAL"
  | "BEGINNER"
  | "INTERMEDIATE"
  | "EXPERIENCED"
  | "HEAVY_WEIGHT"
  | "MARATHON"
  | "SPEED"
  | "TRAIL"
  | "FITNESS"
  | "INJURY_PRONE";

export const TIP_CATEGORIES: TipCategory[] = [
  "GENERAL",
  "BEGINNER",
  "INTERMEDIATE",
  "EXPERIENCED",
  "HEAVY_WEIGHT",
  "MARATHON",
  "SPEED",
  "TRAIL",
  "FITNESS",
  "INJURY_PRONE"
];

export type TipMatchProfile = {
  experienceLevel?: string | null;
  goalType?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  injuryNotes?: string | null;
  injuryHistory?: string | null;
  chronicConditions?: string[] | null;
};

export type LocalizedTip = { id: string; category: TipCategory; text: string };

/** Which tip categories apply to a runner, derived from their goal. Always includes GENERAL. */
export function applicableTipCategories(profile: TipMatchProfile | null | undefined): TipCategory[] {
  const categories = new Set<TipCategory>(["GENERAL"]);
  if (!profile) return [...categories];

  // Experience level.
  if (profile.experienceLevel === "BEGINNER") categories.add("BEGINNER");
  else if (profile.experienceLevel === "INTERMEDIATE") categories.add("INTERMEDIATE");
  else if (profile.experienceLevel === "ADVANCED") categories.add("EXPERIENCED");

  // Goal type.
  if (profile.goalType === "MARATHON" || profile.goalType === "HALF_MARATHON") categories.add("MARATHON");
  if (profile.goalType === "FIVE_K" || profile.goalType === "TEN_K") categories.add("SPEED");
  if (profile.goalType === "TRAIL") categories.add("TRAIL");
  if (profile.goalType === "GENERAL_FITNESS") categories.add("FITNESS");

  // Body metrics + injury history.
  if (isHeavyWeight(profile)) categories.add("HEAVY_WEIGHT");
  if (hasInjuryConcern(profile)) categories.add("INJURY_PRONE");

  return [...categories];
}

// "Heavy weight" runners benefit from lower-impact, joint-protective advice. Use BMI
// (obese threshold) when height is known; otherwise fall back to an absolute weight.
function isHeavyWeight({ weightKg, heightCm }: TipMatchProfile): boolean {
  if (weightKg == null || weightKg <= 0) return false;
  if (heightCm && heightCm > 0) {
    const meters = heightCm / 100;
    return weightKg / (meters * meters) >= 30;
  }
  return weightKg >= 95;
}

// Runners with a recorded injury (past or current) or a chronic condition get
// prevention/prehab tips. "NONE" is the sentinel for "no chronic condition".
function hasInjuryConcern({ injuryNotes, injuryHistory, chronicConditions }: TipMatchProfile): boolean {
  if (injuryNotes?.trim() || injuryHistory?.trim()) return true;
  return Boolean(chronicConditions?.some((condition) => condition && condition !== "NONE"));
}

function pickText(tip: { textEn: string; textFr: string; textAr: string }, locale: CoachLocale): string {
  return locale === "fr" ? tip.textFr : locale === "ar" ? tip.textAr : tip.textEn;
}

// Fisher–Yates in place. Order-only randomness on the server; no hydration concern.
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

type TipRow = { id: string; category: string; textEn: string; textFr: string; textAr: string };

/**
 * Published tips matching a runner's profile, localized. Each applicable category is
 * shuffled independently, then categories are interleaved round-robin (in random order)
 * so the runner reliably sees a mix from every matched category — the profile-specific
 * ones aren't drowned out by the larger GENERAL pool.
 */
export async function getTipsForProfile(
  profile: TipMatchProfile | null | undefined,
  locale: CoachLocale,
  limit = 12
): Promise<LocalizedTip[]> {
  const categories = applicableTipCategories(profile);
  const tips = await getPrisma().coachTip.findMany({
    where: { status: "PUBLISHED", category: { in: categories } },
    select: { id: true, category: true, textEn: true, textFr: true, textAr: true }
  });

  // Bucket by category and shuffle each bucket.
  const buckets = new Map<string, TipRow[]>();
  for (const tip of tips) {
    const bucket = buckets.get(tip.category) ?? [];
    bucket.push(tip);
    buckets.set(tip.category, bucket);
  }
  for (const bucket of buckets.values()) shuffleInPlace(bucket);

  // Round-robin across categories (random category order) until we hit the limit.
  const order = shuffleInPlace([...buckets.keys()]);
  const result: TipRow[] = [];
  let progressed = true;
  while (result.length < limit && progressed) {
    progressed = false;
    for (const category of order) {
      const bucket = buckets.get(category);
      if (bucket && bucket.length > 0) {
        result.push(bucket.shift() as TipRow);
        progressed = true;
        if (result.length >= limit) break;
      }
    }
  }

  return result.map((tip) => ({ id: tip.id, category: tip.category as TipCategory, text: pickText(tip, locale) }));
}
