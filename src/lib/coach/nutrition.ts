import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { CoachError } from "@/lib/coach/errors";

// Fuel & hydration logging. Light by design: a meal is a free-text description with optional
// calories; hydration is an amount in millilitres. Entries are bucketed by day and summarised for
// the daily view and the AI coach's context (fueling around long runs / race week).

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

export const nutritionInputSchema = z
  .object({
    kind: z.enum(["MEAL", "HYDRATION"]),
    loggedFor: z.coerce.date().optional(),
    mealType: z.enum(MEAL_TYPES).nullable().optional(),
    description: z.string().trim().max(300).nullable().optional(),
    calories: z.coerce.number().int().min(0).max(20000).nullable().optional(),
    waterMl: z.coerce.number().int().min(1).max(10000).nullable().optional()
  })
  .refine((v) => (v.kind === "HYDRATION" ? (v.waterMl ?? 0) > 0 : Boolean(v.description?.trim()) || (v.calories ?? 0) > 0), {
    message: "Add a description or amount for this entry."
  });

export type NutritionInput = z.infer<typeof nutritionInputSchema>;

export type NutritionEntryRow = {
  id: string;
  kind: string;
  mealType: string | null;
  description: string | null;
  calories: number | null;
  waterMl: number | null;
  loggedFor: string;
};

export type NutritionDay = {
  date: string; // ISO date (UTC midnight)
  entries: NutritionEntryRow[];
  totalCalories: number;
  totalWaterMl: number;
};

// Normalise any timestamp to that day's UTC midnight, so all of a day's entries share one bucket.
function startOfUtcDay(value: Date): Date {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function logNutritionEntry(userId: string, rawInput: unknown) {
  const input = nutritionInputSchema.parse(rawInput);
  const loggedFor = startOfUtcDay(input.loggedFor ?? new Date());
  if (loggedFor.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new CoachError("That date is in the future.", 400, "INVALID_DATE");
  }
  return getPrisma().nutritionEntry.create({
    data: {
      userId,
      loggedFor,
      kind: input.kind,
      mealType: input.kind === "MEAL" ? input.mealType ?? null : null,
      description: input.description?.trim() || null,
      calories: input.kind === "MEAL" ? input.calories ?? null : null,
      waterMl: input.kind === "HYDRATION" ? input.waterMl ?? null : null
    }
  });
}

export async function deleteNutritionEntry(userId: string, id: string) {
  const result = await getPrisma().nutritionEntry.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new CoachError("Entry was not found.", 404, "ENTRY_NOT_FOUND");
}

function toDay(entries: NutritionEntryRow[], date: string): NutritionDay {
  return {
    date,
    entries,
    totalCalories: entries.reduce((sum, e) => sum + (e.calories ?? 0), 0),
    totalWaterMl: entries.reduce((sum, e) => sum + (e.waterMl ?? 0), 0)
  };
}

// All of a single day's entries plus totals. `date` defaults to today (UTC).
export async function getNutritionDay(userId: string, date?: Date): Promise<NutritionDay> {
  const day = startOfUtcDay(date ?? new Date());
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + 1);
  const rows = await getPrisma().nutritionEntry.findMany({
    where: { userId, loggedFor: { gte: day, lt: next } },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, mealType: true, description: true, calories: true, waterMl: true, loggedFor: true }
  });
  return toDay(rows.map((r) => ({ ...r, loggedFor: r.loggedFor.toISOString() })), day.toISOString());
}

// The last `days` days grouped newest-first, for the log view and coach context.
export async function getRecentNutrition(userId: string, days = 7): Promise<NutritionDay[]> {
  const since = startOfUtcDay(new Date());
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const rows = await getPrisma().nutritionEntry.findMany({
    where: { userId, loggedFor: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, mealType: true, description: true, calories: true, waterMl: true, loggedFor: true }
  });

  const byDay = new Map<string, NutritionEntryRow[]>();
  for (const row of rows) {
    const key = startOfUtcDay(row.loggedFor).toISOString();
    const list = byDay.get(key) ?? [];
    list.push({ ...row, loggedFor: row.loggedFor.toISOString() });
    byDay.set(key, list);
  }
  return [...byDay.entries()]
    .map(([date, entries]) => toDay(entries, date))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// One-line summary for the AI coach context, e.g. "avg ~2100 kcal & ~1.8 L water/day over 5 logged
// days". Returns null when there's nothing logged, so the coach prompt stays clean.
export async function getNutritionCoachSummary(userId: string): Promise<string | null> {
  const days = await getRecentNutrition(userId, 7);
  if (days.length === 0) return null;
  const totalCal = days.reduce((s, d) => s + d.totalCalories, 0);
  const totalWater = days.reduce((s, d) => s + d.totalWaterMl, 0);
  const avgCal = Math.round(totalCal / days.length);
  const avgWaterL = Math.round((totalWater / days.length / 1000) * 10) / 10;
  const parts: string[] = [];
  if (avgCal > 0) parts.push(`~${avgCal} kcal`);
  if (avgWaterL > 0) parts.push(`~${avgWaterL} L water`);
  if (parts.length === 0) return null;
  return `${parts.join(" & ")}/day over ${days.length} logged day${days.length === 1 ? "" : "s"}`;
}
