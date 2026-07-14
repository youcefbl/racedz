import { ALGERIA_WILAYAS } from "@/lib/algeria";
import type { ExtractedRace } from "./extract";

// Distance→type buckets, mirroring the importer in scripts/import-coursealgerie.ts and the LLM prompt.
type RaceType =
  | "ROAD"
  | "TRAIL"
  | "ULTRA_TRAIL"
  | "MARATHON"
  | "HALF_MARATHON"
  | "TEN_K"
  | "FIVE_K"
  | "KIDS"
  | "CHARITY"
  | "OTHER";

export type NormalizedCategory = {
  name: string;
  raceType: RaceType;
  distanceKm: number;
  priceDzd?: number;
  startTime?: Date;
};

export type NormalizedDraft = {
  title: string;
  description: string;
  raceType: RaceType;
  startDate: Date;
  startDateWasMissing: boolean;
  registrationCloseAt?: Date;
  wilaya: string;
  city: string;
  commune?: string;
  address?: string;
  organizerName?: string;
  organizerUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  baridiMobNumber?: string;
  ccpAccount?: string;
  ccpKey?: string;
  maxParticipants?: number;
  elevationGainText?: string;
  categories: NormalizedCategory[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Snap a free-text location to one of Algeria's 58 official wilayas (accent/case/punctuation
// insensitive), or null when nothing matches. The model is asked to pick from the list already;
// this guards against spelling drift ("Béjaïa" → "Bejaia", "tizi-ouzou" → "Tizi Ouzou").
export function normalizeWilaya(input: string | null | undefined): string | null {
  if (!input) return null;
  const needle = canonical(input);
  if (!needle) return null;

  const exact = ALGERIA_WILAYAS.find((w) => canonical(w) === needle);
  if (exact) return exact;

  // Fall back to containment so "Alger Centre" or "wilaya de Blida" still resolve.
  const partial = ALGERIA_WILAYAS.find((w) => {
    const c = canonical(w);
    return needle.includes(c) || c.includes(needle);
  });
  return partial ?? null;
}

export function inferRaceType(distanceKm: number | null | undefined, hint: string | null | undefined): RaceType {
  const text = (hint ?? "").toLowerCase();
  if (/\btrail|montagne|mountain\b/.test(text)) return distanceKm && distanceKm > 42 ? "ULTRA_TRAIL" : "TRAIL";
  if (/\bkids?|enfant|أطفال\b/.test(text)) return "KIDS";
  if (typeof distanceKm === "number") {
    if (distanceKm > 42) return "ULTRA_TRAIL";
    if (distanceKm >= 40) return "MARATHON";
    if (distanceKm >= 20) return "HALF_MARATHON";
    if (distanceKm >= 9 && distanceKm <= 11) return "TEN_K";
    if (distanceKm >= 4 && distanceKm <= 6) return "FIVE_K";
    return "ROAD";
  }
  return "OTHER";
}

/**
 * Turn a raw LLM extraction into a payload that is always safe to persist as a DRAFT: valid title,
 * a real start date (placeholder + flag if the post omitted one), a canonical wilaya, and at least
 * one category. Anything genuinely unknown is left for the admin to fill in the review step.
 */
export function normalizeExtractedRace(race: ExtractedRace, fallbackCaption: string): NormalizedDraft {
  const title = firstNonEmpty(race.title) ?? "Imported race (draft)";

  const description =
    firstNonEmpty(race.description) ??
    firstNonEmpty(fallbackCaption) ??
    "Draft imported from a social-media post — please review and complete the details before publishing.";

  const parsedStart = parseDate(race.startDate);
  const startDateWasMissing = !parsedStart;
  // No usable date in the post → a clearly-provisional placeholder 30 days out. It's a DRAFT and the
  // admin must confirm the date before publishing; the banner flags that this was assumed.
  const startDate = applyClockTime(parsedStart ?? new Date(Date.now() + 30 * DAY_MS), race.startTime);

  const categories = normalizeCategories(race, startDate);
  const raceType = race.raceType ?? categories[0]?.raceType ?? "OTHER";

  const wilaya =
    normalizeWilaya(race.wilaya) ?? normalizeWilaya(race.city) ?? firstNonEmpty(race.wilaya) ?? firstNonEmpty(race.city) ?? "Alger";
  const city = firstNonEmpty(race.city) ?? wilaya;

  return {
    title,
    description,
    raceType,
    startDate,
    startDateWasMissing,
    registrationCloseAt: parseDate(race.registrationCloseAt) ?? undefined,
    wilaya,
    city,
    commune: firstNonEmpty(race.commune),
    address: firstNonEmpty(race.address),
    organizerName: firstNonEmpty(race.organizerName),
    organizerUrl: normalizeUrl(race.organizerUrl),
    contactPhone: firstNonEmpty(race.contactPhone),
    contactEmail: firstNonEmpty(race.contactEmail),
    baridiMobNumber: firstNonEmpty(race.baridiMobNumber),
    ccpAccount: firstNonEmpty(race.ccpAccount),
    ccpKey: firstNonEmpty(race.ccpKey),
    maxParticipants: positiveInt(race.maxParticipants),
    elevationGainText: firstNonEmpty(race.elevationGainText),
    categories
  };
}

function normalizeCategories(race: ExtractedRace, startDate: Date): NormalizedCategory[] {
  const mapped = race.categories
    .map((category): NormalizedCategory | null => {
      const distanceKm = typeof category.distanceKm === "number" && category.distanceKm > 0 ? category.distanceKm : null;
      if (!distanceKm) return null;
      const name = firstNonEmpty(category.name) ?? `${trimNumber(distanceKm)} km`;
      return {
        name: name.length >= 2 ? name : `${trimNumber(distanceKm)} km`,
        raceType: inferRaceType(distanceKm, race.raceType),
        distanceKm,
        priceDzd: positiveInt(category.priceDzd),
        startTime: category.startTime ? applyClockTime(new Date(startDate), category.startTime) : undefined
      };
    })
    .filter((category): category is NormalizedCategory => category !== null);

  if (mapped.length > 0) return mapped.slice(0, 12);

  // Nothing extractable → a single placeholder distance so the draft is valid; admin edits it.
  return [{ name: "Course", raceType: inferRaceType(null, race.raceType), distanceKm: 10 }];
}

function canonical(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function firstNonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeUrl(value: string | null | undefined): string | undefined {
  const trimmed = firstNonEmpty(value);
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Bare handle/domain — make it a valid absolute URL so it passes url() validation downstream.
  return `https://${trimmed.replace(/^@/, "")}`;
}

function parseDate(value: string | null | undefined): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  // Guard against absurd years from a misread; keep only plausible race dates.
  const year = parsed.getFullYear();
  if (year < 2000 || year > 2100) return undefined;
  return parsed;
}

// Overlay an "HH:MM" clock time onto a date, keeping the calendar day. No-op for a missing/invalid time.
function applyClockTime(date: Date, time: string | null | undefined): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? "");
  if (!match) return date;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return date;
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function positiveInt(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : undefined;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
