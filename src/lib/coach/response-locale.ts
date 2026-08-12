export type CoachResponseLocale = "en" | "fr" | "ar";

// Arabic-script questions are unambiguous. Arabizi is less so, therefore its detector stays
// deliberately vocabulary-based: it recognises common Algerian/Maghrebi chat forms without
// classifying ordinary French or English containing a stray digit as Arabic.
const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const ARABIZI_MARKER =
  /\b(?:wach|wesh|weche|rani|rak|rahi|rana|ndir|ndiro|njri|nrouh|nroh|bezaf|bzaf|mlih|mli7|saha|s7a|3andi|3andek|7abit|kifach|chhal|win|3lach|makach|ma3lich|khoya|khti|chno|daba|ghadi|barsha|tawa|behi|famma|najem|bghit)\b/i;

/** Whether a live Coach question is Arabic, in Arabic script or recognisable Arabizi. */
export function isArabicCoachQuestion(message: string | null | undefined): boolean {
  const value = message?.trim();
  return Boolean(value && (ARABIC_SCRIPT.test(value) || ARABIZI_MARKER.test(value)));
}

/**
 * A live Arabic question overrides the saved Coach language for this answer only. Other questions
 * keep the runner's chosen language; this does not silently change their goal preference.
 */
export function resolveCoachResponseLocale(
  preferredLocale: CoachResponseLocale,
  message: string | null | undefined,
): CoachResponseLocale {
  return isArabicCoachQuestion(message) ? "ar" : preferredLocale;
}
