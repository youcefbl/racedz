import type { CoachLocale } from "@/components/coach/types";
import type { AudioProfileId } from "@/lib/coach/audio-coaching";
import { audioCueText } from "@/lib/coach/audio-copy";
import { roleLabel, type StepRole } from "@/lib/coach/workout-structure";

// Allowlist for the cloud-TTS endpoint (review T0-R03, owner decision 2026-08-02): synthesis is a
// billed provider call that produces cached audio, so it accepts ONLY the phrases the guided-run
// audio coach can legitimately speak — never arbitrary prose. The allowlist is derived from the
// same generators the clients use (audioCueText, stepPhrase vocabulary), so a new cue added there
// is automatically permitted; anything else — chat text, user content, injected prose — is refused
// before the provider is contacted.

const PROFILES: AudioProfileId[] = ["INTERVAL", "TEMPO", "EASY", "LONG_RUN", "RECOVERY", "RACE", "STRIDES", "THRESHOLD"];
const ROLES: StepRole[] = ["WARMUP", "WORK", "RECOVERY", "STEADY", "COOLDOWN"];

// Pool-based cues rotate by index; probing 0..9 covers every pool (all pools are smaller) and the
// Set dedupes the wrap-around repeats.
const POOL_PROBE = 10;

function staticPhrasesFor(locale: CoachLocale): Set<string> {
  const phrases = new Set<string>();
  for (const profile of PROFILES) {
    phrases.add(audioCueText({ kind: "pace", direction: "slower" }, profile, locale));
    phrases.add(audioCueText({ kind: "pace", direction: "faster" }, profile, locale));
    for (let index = 0; index < POOL_PROBE; index += 1) {
      phrases.add(audioCueText({ kind: "checkIn", index }, profile, locale));
      phrases.add(audioCueText({ kind: "form", index }, profile, locale));
    }
    for (const kind of ["hydrate", "halfway", "lastKm", "oneMinuteLeft", "midStep", "lastRep", "warmupTip", "warmupLastMinute", "cooldownTip"] as const) {
      phrases.add(audioCueText({ kind }, profile, locale));
    }
  }
  // The guided-session finish flourish (cues.ts completePhrase) — a literal, mirrored here.
  phrases.add(locale === "fr" ? "Séance terminée" : locale === "ar" ? "انتهت الحصة" : "Workout complete");
  return phrases;
}

const STATIC_PHRASES: Record<CoachLocale, Set<string>> = {
  en: staticPhrasesFor("en"),
  fr: staticPhrasesFor("fr"),
  ar: staticPhrasesFor("ar")
};

// spokenDuration() output shapes (audio-copy.ts): "42 seconds" / "5 minutes" / "5 minutes 42",
// with the locale-specific words. Bounded digits so a pathological request can't smuggle prose.
const DURATION_PATTERN: Record<CoachLocale, string> = {
  en: "(?:\\d{1,3} seconds|\\d{1,3} minutes(?: \\d{1,2})?)",
  fr: "(?:\\d{1,3} secondes|\\d{1,3} minutes(?: \\d{1,2})?)",
  ar: "(?:\\d{1,3} ثانية|\\d{1,3} دقيقة(?: و\\d{1,2} ثانية)?)"
};

// describeTarget() output shapes (workout-structure.ts): "400 m" / "1.5 km" / "3:00" / open label.
const TARGET_PATTERN: Record<CoachLocale, string> = {
  en: "(?:\\d{1,5} m|\\d{1,3}(?:\\.\\d)? km|\\d{1,3}:\\d{2}|Open)",
  fr: "(?:\\d{1,5} m|\\d{1,3}(?:\\.\\d)? km|\\d{1,3}:\\d{2}|Libre)",
  ar: "(?:\\d{1,5} m|\\d{1,3}(?:\\.\\d)? km|\\d{1,3}:\\d{2}|حر)"
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Dynamic phrase families, one compiled matcher set per locale:
// split ("Kilometre 4. 5 minutes 42."), repSplit ("Rep done in 1 minutes 30."), and
// stepPhrase ("Work 2/6, 400 m" or a bare role for open steps — cues.ts stepPhrase()).
function dynamicPatternsFor(locale: CoachLocale): RegExp[] {
  const duration = DURATION_PATTERN[locale];
  const target = TARGET_PATTERN[locale];
  const roles = ROLES.map((role) => escapeRegExp(roleLabel(role, locale))).join("|");
  const separator = locale === "ar" ? "،" : ",";
  const kilometre = locale === "fr" ? "Kilomètre" : locale === "ar" ? "الكيلومتر" : "Kilometre";
  const repDone = locale === "fr" ? "Fraction terminée en" : locale === "ar" ? "أنهيت التكرار في" : "Rep done in";
  return [
    new RegExp(`^${kilometre} \\d{1,3}\\. ${duration}\\.$`, "u"),
    new RegExp(`^${repDone} ${duration}\\.$`, "u"),
    new RegExp(`^(?:${roles})(?: \\d{1,2}/\\d{1,2})?${separator} ${target}$`, "u"),
    new RegExp(`^(?:${roles})$`, "u")
  ];
}

const DYNAMIC_PATTERNS: Record<CoachLocale, RegExp[]> = {
  en: dynamicPatternsFor("en"),
  fr: dynamicPatternsFor("fr"),
  ar: dynamicPatternsFor("ar")
};

/** True when the text is a phrase the guided-run audio coach can legitimately speak. */
export function isAllowedCueText(text: string, locale: CoachLocale): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (STATIC_PHRASES[locale].has(trimmed)) return true;
  return DYNAMIC_PATTERNS[locale].some((pattern) => pattern.test(trimmed));
}
