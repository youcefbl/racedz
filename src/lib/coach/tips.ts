import "server-only";

import { getPrisma } from "@/lib/db";
import type { CoachLocale } from "@/components/coach/types";

// Matching + localization for DB-backed coach tips. A tip's `category` decides which
// runners see it; GENERAL tips show to everyone. Categories are derived from the
// runner's active RunnerGoal (experience, goal type, and body metrics) with no extra
// input required. Tip text is stored per-language (textEn/textFr/textAr).

export type TipCategory = "GENERAL" | "BEGINNER" | "HEAVY_WEIGHT" | "EXPERIENCED" | "MARATHON";

export const TIP_CATEGORIES: TipCategory[] = ["GENERAL", "BEGINNER", "HEAVY_WEIGHT", "EXPERIENCED", "MARATHON"];

export type TipMatchProfile = {
  experienceLevel?: string | null;
  goalType?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
};

export type LocalizedTip = { id: string; category: TipCategory; text: string };

/** Which tip categories apply to a runner. Always includes GENERAL. */
export function applicableTipCategories(profile: TipMatchProfile | null | undefined): TipCategory[] {
  const categories = new Set<TipCategory>(["GENERAL"]);
  if (!profile) return [...categories];

  if (profile.experienceLevel === "BEGINNER") categories.add("BEGINNER");
  if (profile.experienceLevel === "ADVANCED") categories.add("EXPERIENCED");
  if (profile.goalType === "MARATHON" || profile.goalType === "HALF_MARATHON") categories.add("MARATHON");
  if (isHeavyWeight(profile)) categories.add("HEAVY_WEIGHT");

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

function pickText(tip: { textEn: string; textFr: string; textAr: string }, locale: CoachLocale): string {
  return locale === "fr" ? tip.textFr : locale === "ar" ? tip.textAr : tip.textEn;
}

// Fisher–Yates so a runner sees a fresh order each dashboard load rather than always the
// same first tip. Order-only randomness on the server; no hydration concern.
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Published tips matching a runner's profile, localized and shuffled. */
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

  return shuffle(tips)
    .slice(0, limit)
    .map((tip) => ({ id: tip.id, category: tip.category as TipCategory, text: pickText(tip, locale) }));
}
