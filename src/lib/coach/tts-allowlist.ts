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
  phrases.add(locale === "fr" ? "Séance terminée" : locale === "ar" ? "كمّلت الحصة" : "Workout complete");
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
  ar: "(?:\\d{1,5} m|\\d{1,3}(?:\\.\\d)? km|\\d{1,3}:\\d{2}|بلا حد)"
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
  const repDone = locale === "fr" ? "Fraction terminée en" : locale === "ar" ? "كمّلت التكرار في" : "Rep done in";
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

// ---------------------------------------------------------------------------------------------
// Native Android cue families.
//
// The native app builds its cues from Android string resources, not from audio-copy.ts, and the
// shapes genuinely differ — "Kilometre 4. Pace 5:42/km" where the web says "Kilometre 4. 5 minutes
// 42." — so none of the patterns above match a single native cue. Without this section every cloud
// cue from the phone is refused as UNSUPPORTED_CUE, which fails silently (a failed fetch is just
// no audio) and would have looked like the fallback simply not working.
//
// Mirrors native-android/core/design/src/main/res/values*/strings.xml. That duplication is real,
// so it is guarded rather than trusted: `npm run test:tts-allowlist` parses those XML files and
// asserts every cue family still passes, and fails if the Android copy is edited without updating
// this list. Kept exactly as tight as the web families — role words, bounded digits, fixed shapes.

type NativeCueVocabulary = {
  kilometre: string;
  pace: string;
  roles: string[];
  units: string[];
  done: string;
  /**
   * The mid-step coaching cues (NATGAP-15) — fixed sentences, so they are matched literally.
   *
   * Most of these are word-for-word the web's own copy, but they must still be listed: the
   * generators above only produce a phrase when a *profile* asks for it, and the native engine
   * decides for itself. A cue absent here is refused as UNSUPPORTED_CUE and, because a failed
   * fetch is indistinguishable from no audio, is silently never spoken on a device with no voice.
   */
  guidance: string[];
  /** "Rep done in {duration}." — the one native cue with an interpolated value. */
  repDone: string;
};

const NATIVE_CUES: Record<CoachLocale, NativeCueVocabulary> = {
  en: {
    kilometre: "Kilometre",
    pace: "Pace",
    roles: ["Warm up", "Work", "Recover", "Cool down", "Steady"],
    units: ["min", "sec", "m"],
    done: "Session complete. Cool down when you are ready.",
    guidance: [
      "Start nice and gentle. Let your body warm up gradually.",
      "One minute of warm-up left. Get ready to work.",
      "Well done. Ease right off and let your breathing settle.",
      "One minute left. Hold it there.",
      "Halfway through the rep. Stay controlled, don't push.",
      "Last one. Make it count.",
      "Halfway there. You're doing great.",
      "Last kilometre. Finish strong.",
      "Take a drink if you can."
    ],
    repDone: "Rep done in"
  },
  fr: {
    kilometre: "Kilomètre",
    pace: "Allure",
    roles: ["Échauffement", "Effort", "Récupération", "Retour au calme", "Régulier"],
    units: ["min", "s", "m"],
    done: "Séance terminée. Retour au calme quand vous voulez.",
    guidance: [
      "Commencez tout doucement. Laissez le corps monter en température.",
      "Encore une minute d'échauffement. Préparez-vous à travailler.",
      "Bien joué. Relâchez complètement et laissez la respiration se calmer.",
      "Encore une minute. Tenez bon.",
      "Mi-fraction. Restez en contrôle, ne forcez pas.",
      "Dernière fraction. Donnez tout, proprement.",
      "Mi-parcours. Vous gérez très bien.",
      "Dernier kilomètre. Terminez en beauté.",
      "Pensez à boire si vous le pouvez."
    ],
    repDone: "Fraction terminée en"
  },
  ar: {
    kilometre: "كيلومتر",
    pace: "الريتم",
    roles: ["تسخين", "مجهود", "استرجاع", "تهدئة", "ثابت"],
    units: ["د", "ثانية", "م"],
    done: "كمّلت الحصة. هدّي كي تحب.",
    guidance: [
      "ابدا بالهانية وخلي جسمك يسخن بالشوية.",
      "بقات دقيقة فالتسخين. وجّد روحك للمجهود.",
      "مليح. هبّط الريتم وخلي النفس يهدأ.",
      "بقات دقيقة وحدة. خليك في نفس الريتم.",
      "وصلت للنص. تحكّم فالريتم وما تزيدش بزاف.",
      "آخر تكرار. عطيلو واش عندك.",
      "وصلت لنص المسافة. راك داير مليح.",
      "آخر كيلومتر. كمّل بقوة.",
      "اشرب شوية ما إذا تقدر."
    ],
    repDone: "كمّلت التكرار فـ"
  }
};

function nativePatternsFor(locale: CoachLocale): RegExp[] {
  const vocabulary = NATIVE_CUES[locale];
  const roles = vocabulary.roles.map(escapeRegExp).join("|");
  const units = vocabulary.units.map(escapeRegExp).join("|");
  return [
    // "Rep done in 1:30." — ZidRunFormat.duration, so m:ss or h:mm:ss, not the web's spoken words.
    new RegExp(`^${escapeRegExp(vocabulary.repDone)} \\d{1,2}:\\d{2}(?::\\d{2})?\\.$`, "u"),
    // "Kilometre 4. Pace 5:42/km"
    new RegExp(`^${escapeRegExp(vocabulary.kilometre)} \\d{1,3}\\. ${escapeRegExp(vocabulary.pace)} \\d{1,3}:\\d{2}/km$`, "u"),
    // "Work. 5 min" — and the bare role an open-ended step produces, where the target is empty.
    new RegExp(`^(?:${roles})\\.(?: \\d{1,5} (?:${units}))?$`, "u")
  ];
}

const NATIVE_PATTERNS: Record<CoachLocale, RegExp[]> = {
  en: nativePatternsFor("en"),
  fr: nativePatternsFor("fr"),
  ar: nativePatternsFor("ar")
};

/**
 * Strips Unicode bidi controls before matching.
 *
 * The native formatter wraps a pace in a first-strong isolate (U+2068/U+2069) so "5:42/km" reads
 * left-to-right inside an Arabic sentence. Those characters carry no sound, and leaving them in
 * would make an otherwise legitimate cue fail an exact match — and would fragment the audio cache
 * into isolate-bearing and isolate-free copies of the same phrase.
 */
function stripBidi(value: string): string {
  return value.replace(/[\u200E\u200F\u2066-\u2069\u202A-\u202E]/g, "");
}

/** True when the text is a phrase the guided-run audio coach can legitimately speak. */
export function isAllowedCueText(text: string, locale: CoachLocale): boolean {
  const trimmed = stripBidi(text).trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (STATIC_PHRASES[locale].has(trimmed)) return true;
  if (NATIVE_CUES[locale].done === trimmed) return true;
  if (NATIVE_CUES[locale].guidance.includes(trimmed)) return true;
  if (DYNAMIC_PATTERNS[locale].some((pattern) => pattern.test(trimmed))) return true;
  return NATIVE_PATTERNS[locale].some((pattern) => pattern.test(trimmed));
}
