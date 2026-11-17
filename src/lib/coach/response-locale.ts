export type CoachResponseLocale = "en" | "fr" | "ar";

// Arabic-script questions are unambiguous. Arabizi is less so, therefore its detector stays
// deliberately vocabulary-based: it recognises common Algerian/Maghrebi chat forms without
// classifying ordinary French or English containing a stray digit as Arabic. Never list a marker
// that is also a common English or French word: `win` ("where") once made "Could I win my age
// group?" answer in darija. `win` alone is not distinctive; real arabizi carries other markers.
const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const ARABIZI_MARKER =
  /\b(?:wach|wesh|weche|rani|rak|rahi|rana|ndir|ndiro|njri|nrouh|nroh|bezaf|bzaf|mlih|mli7|saha|s7a|3andi|3andek|7abit|kifach|chhal|3lach|makach|ma3lich|khoya|khti|chno|daba|ghadi|barsha|tawa|behi|famma|najem|bghit)\b/i;

/** Whether a live Coach question is Arabic, in Arabic script or recognisable Arabizi. */
export function isArabicCoachQuestion(message: string | null | undefined): boolean {
  const value = message?.trim();
  return Boolean(value && (ARABIC_SCRIPT.test(value) || ARABIZI_MARKER.test(value)));
}

/**
 * A live Arabic question overrides the saved Coach language for this answer only. Otherwise the
 * language the app is being read in right now ([appLocale], sent by the client) wins: an English
 * question asked in the English app got a Darija answer because the goal had been saved in Arabic
 * (M21, 2026-11-17). Without that hint (older clients, server-initiated reviews) the goal's
 * language stands. Nothing here changes the stored preference.
 */
export function resolveCoachResponseLocale(
  preferredLocale: CoachResponseLocale,
  message: string | null | undefined,
  appLocale?: CoachResponseLocale | null,
): CoachResponseLocale {
  if (isArabicCoachQuestion(message)) return "ar";
  return appLocale ?? preferredLocale;
}
