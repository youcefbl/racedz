/**
 * The spoken vocabulary of the native run voice: every clip the app ships, per locale.
 *
 * The phone composes a cue ("5 kilometres. Time 27 minutes 30 seconds. Pace 5 minutes 30 per
 * kilometre.") by playing these clips back to back, so it speaks the same voice on every phone,
 * offline, in the runner's language — no device speech engine or language pack needed. The keys
 * are a contract with `CueComposer.kt` (feature:runs); its unit test reads the generated
 * `manifest.json` and fails if a key it can emit is missing here.
 *
 * Arabic is central-Algerian Darija written out in words, never digits: a TTS model reads "5 دقائق"
 * as standard Arabic, while "خمس دقايق" comes out in the runner's own dialect. Counted nouns follow
 * Darija agreement (1 → singular, 2 → جوج + plural, 3–10 → short form + plural, 11+ → singular),
 * and "و" is baked into the following clip (`min_and_*`, `sec_and_*`) because a lone "و" is read as
 * the letter's name.
 *
 * Regenerate with `npm run cues:generate` after editing; unchanged clips are not re-synthesized.
 */

export type CueLocale = "en" | "fr" | "ar";
export const CUE_LOCALES: CueLocale[] = ["en", "fr", "ar"];

export const NUMBER_MAX = 100;
export const MINUTE_MAX = 59;
export const SECOND_MAX = 59;
export const HOUR_MAX = 9;
export const METRE_STEPS = Array.from({ length: 19 }, (_, i) => (i + 1) * 50); // 50..950

type Phrases = Record<string, string>;

const FIXED: Record<CueLocale, Phrases> = {
  en: {
    started: "Recording started.",
    paused: "Paused.",
    resumed: "Resumed.",
    done: "Session complete. Cool down when you are ready.",
    tip_warmup: "Start nice and gentle. Let your body warm up gradually.",
    tip_warmup_last_minute: "One minute of warm-up left. Get ready to work.",
    tip_cooldown: "Well done. Ease right off and let your breathing settle.",
    tip_one_minute_left: "One minute left. Hold it there.",
    tip_mid_step: "Halfway through the rep. Stay controlled, don't push.",
    tip_last_rep: "Last one. Make it count.",
    tip_halfway: "Halfway there. You're doing great.",
    tip_last_km: "Last kilometre. Finish strong.",
    tip_hydrate: "Take a drink if you can.",
    step_warmup: "Warm up.",
    step_work: "Work.",
    step_recovery: "Recover.",
    step_cooldown: "Cool down.",
    step_steady: "Steady.",
    word_time: "Time",
    word_pace: "Pace",
    word_point: "point",
    word_in: "in",
    unit_km: "kilometres",
    unit_km_one: "kilometre",
    unit_mi: "miles",
    unit_mi_one: "mile",
    per_km: "per kilometre",
    per_mi: "per mile",
    run_finished: "Run finished.",
    rep_done: "Rep done in",
  },
  fr: {
    started: "Enregistrement démarré.",
    paused: "En pause.",
    resumed: "Reprise.",
    done: "Séance terminée. Retour au calme quand vous voulez.",
    tip_warmup: "Commencez tout doucement. Laissez le corps monter en température.",
    tip_warmup_last_minute: "Encore une minute d'échauffement. Préparez-vous à travailler.",
    tip_cooldown: "Bien joué. Relâchez complètement et laissez la respiration se calmer.",
    tip_one_minute_left: "Encore une minute. Tenez bon.",
    tip_mid_step: "Mi-fraction. Restez en contrôle, ne forcez pas.",
    tip_last_rep: "Dernière fraction. Donnez tout, proprement.",
    tip_halfway: "Mi-parcours. Vous gérez très bien.",
    tip_last_km: "Dernier kilomètre. Terminez en beauté.",
    tip_hydrate: "Pensez à boire si vous le pouvez.",
    step_warmup: "Échauffement.",
    step_work: "Effort.",
    step_recovery: "Récupération.",
    step_cooldown: "Retour au calme.",
    step_steady: "Régulier.",
    word_time: "Temps",
    word_pace: "Allure",
    word_point: "virgule",
    word_in: "en",
    unit_km: "kilomètres",
    unit_km_one: "kilomètre",
    unit_mi: "miles",
    unit_mi_one: "mile",
    per_km: "au kilomètre",
    per_mi: "au mile",
    run_finished: "Course terminée.",
    rep_done: "Fraction terminée en",
  },
  ar: {
    started: "بدا التسجيل.",
    paused: "حبسنا.",
    resumed: "كمّلنا.",
    done: "كمّلت الحصة. هدّي كي تحب.",
    tip_warmup: "ابدا بالهانية وخلي جسمك يسخن بالشوية.",
    tip_warmup_last_minute: "بقات دقيقة فالتسخين. وجّد روحك للمجهود.",
    tip_cooldown: "مليح. هبّط الريتم وخلي النفس يهدأ.",
    tip_one_minute_left: "بقات دقيقة وحدة. خليك في نفس الريتم.",
    tip_mid_step: "وصلت للنص. تحكّم فالريتم وما تزيدش بزاف.",
    tip_last_rep: "آخر تكرار. عطيلو واش عندك.",
    tip_halfway: "وصلت لنص المسافة. راك داير مليح.",
    tip_last_km: "آخر كيلومتر. كمّل بقوة.",
    tip_hydrate: "اشرب شوية ما إذا تقدر.",
    step_warmup: "تسخين.",
    step_work: "مجهود.",
    step_recovery: "استرجاع.",
    step_cooldown: "تهدئة.",
    step_steady: "ثابت.",
    word_time: "الوقت",
    word_pace: "الريتم",
    word_point: "فاصلة",
    word_in: "في",
    unit_km: "كيلومتر",
    unit_km_one: "كيلومتر",
    unit_mi: "ميل",
    unit_mi_one: "ميل",
    per_km: "في الكيلومتر",
    per_mi: "في الميل",
    run_finished: "كمّلت الجري.",
    rep_done: "كمّلت التكرار في",
  },
};

// ---- Darija numbers -----------------------------------------------------------------------------

const DZ_UNITS = ["صفر", "واحد", "جوج", "ثلاثة", "ربعة", "خمسة", "ستة", "سبعة", "ثمنية", "تسعة", "عشرة"];
const DZ_TEENS: Record<number, string> = {
  11: "حداش", 12: "طناش", 13: "ثلطاش", 14: "ربعطاش", 15: "خمسطاش",
  16: "سطاش", 17: "سبعطاش", 18: "ثمنطاش", 19: "تسعطاش",
};
const DZ_TENS: Record<number, string> = {
  20: "عشرين", 30: "ثلاثين", 40: "ربعين", 50: "خمسين", 60: "ستين", 70: "سبعين", 80: "ثمانين", 90: "تسعين",
};
/** Short forms used before a counted plural noun (3–10): "خمس دقايق", not "خمسة دقايق". */
const DZ_SHORT: Record<number, string> = {
  3: "ثلث", 4: "ربع", 5: "خمس", 6: "ست", 7: "سبع", 8: "ثمن", 9: "تسع", 10: "عشر",
};

export function darijaNumber(n: number): string {
  if (n === 100) return "مية";
  if (n <= 10) return DZ_UNITS[n];
  if (n < 20) return DZ_TEENS[n];
  const tens = Math.floor(n / 10) * 10;
  const unit = n % 10;
  return unit === 0 ? DZ_TENS[tens] : `${DZ_UNITS[unit]} و ${DZ_TENS[tens]}`;
}

function darijaCounted(n: number, one: string, plural: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return `جوج ${plural}`;
  if (n <= 10) return `${DZ_SHORT[n]} ${plural}`;
  return `${darijaNumber(n)} ${many}`;
}

function darijaHundreds(h: number): string {
  if (h === 1) return "مية";
  if (h === 2) return "ميتين";
  return `${DZ_SHORT[h]} مية`;
}

function darijaMetres(m: number): string {
  const h = Math.floor(m / 100);
  const rest = m % 100;
  const parts = [h > 0 ? darijaHundreds(h) : null, rest > 0 ? darijaNumber(rest) : null].filter(Boolean);
  return `${parts.join(" و ")} ميتر`;
}

// ---- English / French number words ---------------------------------------------------------------
// A lone digit is ambiguous to the voice model ("5" with no context came back as Chinese "五" in a
// transcription round-trip), so bare numbers are spelled out. Inside a phrase ("27 minutes") digits
// are read correctly, and in French get the right gender ("vingt et une minutes").

const EN_SMALL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function englishNumber(n: number): string {
  if (n === 100) return "one hundred";
  if (n < 20) return EN_SMALL[n];
  const unit = n % 10;
  return unit === 0 ? EN_TENS[Math.floor(n / 10)] : `${EN_TENS[Math.floor(n / 10)]}-${EN_SMALL[unit]}`;
}

const FR_SMALL = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const FR_TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

export function frenchNumber(n: number): string {
  if (n === 100) return "cent";
  if (n < 20) return FR_SMALL[n];
  if (n < 70) {
    const tens = FR_TENS[Math.floor(n / 10)];
    const unit = n % 10;
    if (unit === 0) return tens;
    return unit === 1 ? `${tens} et un` : `${tens}-${FR_SMALL[unit]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${FR_SMALL[n - 60]}`;
  if (n === 80) return "quatre-vingts";
  return `quatre-vingt-${FR_SMALL[n - 80]}`;
}

/** French feminine agreement (une minute, vingt et une secondes, trente et une heures). */
function frenchFeminine(n: number): string {
  return frenchNumber(n).replace(/(^|[ -])un$/, "$1une");
}

/** 50..950 m in French words: "quatre cents", "deux cent cinquante". */
function frenchMetres(m: number): string {
  const h = Math.floor(m / 100);
  const rest = m % 100;
  const hundreds = h === 0 ? "" : h === 1 ? "cent" : `${frenchNumber(h)} cent${rest === 0 ? "s" : ""}`;
  return [hundreds, rest > 0 ? frenchNumber(rest) : ""].filter(Boolean).join(" ");
}

function englishMetres(m: number): string {
  const h = Math.floor(m / 100);
  const rest = m % 100;
  return [h > 0 ? `${englishNumber(h)} hundred` : "", rest > 0 ? englishNumber(rest) : ""].filter(Boolean).join(" ");
}

// ---- Composite clips ----------------------------------------------------------------------------

function counted(locale: CueLocale, n: number, unit: "minute" | "second" | "hour"): string {
  if (locale === "ar") {
    if (unit === "minute") return darijaCounted(n, "دقيقة", "دقايق", "دقيقة");
    if (unit === "second") return darijaCounted(n, "ثانية", "ثواني", "ثانية");
    return darijaCounted(n, "ساعة", "سوايع", "ساعة");
  }
  // Spelled out, never digits: "12 minutes" is the same text in English and French, and the voice
  // model read the French clip in English (caught by a transcription round-trip, 2026-11-15).
  if (locale === "fr") {
    const [one, many] = { minute: ["minute", "minutes"], second: ["seconde", "secondes"], hour: ["heure", "heures"] }[unit];
    return `${frenchFeminine(n)} ${n === 1 ? one : many}`;
  }
  const [one, many] = { minute: ["minute", "minutes"], second: ["second", "seconds"], hour: ["hour", "hours"] }[unit];
  return `${englishNumber(n)} ${n === 1 ? one : many}`;
}

/** Every clip for a locale: key → text to synthesize. */
export function vocabularyFor(locale: CueLocale): Phrases {
  const out: Phrases = { ...FIXED[locale] };
  for (let n = 0; n <= NUMBER_MAX; n++) out[`num_${n}`] = locale === "ar" ? darijaNumber(n) : locale === "fr" ? frenchNumber(n) : englishNumber(n);
  for (let n = 1; n <= MINUTE_MAX; n++) out[`min_${n}`] = counted(locale, n, "minute");
  for (let n = 1; n <= SECOND_MAX; n++) out[`sec_${n}`] = counted(locale, n, "second");
  for (let n = 1; n <= HOUR_MAX; n++) out[`hr_${n}`] = counted(locale, n, "hour");
  for (const m of METRE_STEPS) {
    out[`m_${m}`] = locale === "ar" ? darijaMetres(m)
      : locale === "fr" ? `${frenchMetres(m)} mètres` : `${englishMetres(m)} metres`;
  }
  if (locale === "ar") {
    for (let n = 1; n <= MINUTE_MAX; n++) out[`min_and_${n}`] = `و ${counted(locale, n, "minute")}`;
    for (let n = 1; n <= SECOND_MAX; n++) out[`sec_and_${n}`] = `و ${counted(locale, n, "second")}`;
  }
  return out;
}

/** Delivery note sent with every clip, so separately generated clips sound like one speaker. */
export const VOICE_INSTRUCTIONS: Record<CueLocale, string> = {
  en: "A calm, clear, encouraging running coach speaking into earphones. Even pace, friendly, no drama. Read exactly the text.",
  fr: "Un coach de course calme, clair et encourageant, dans les écouteurs. Débit régulier, accent français neutre. Lis exactement le texte.",
  ar: "كوتش جري هادي وواضح ومشجّع، يهدر في السماعات. اهدر بالدارجة الجزائرية تاع العاصمة، ماشي بالفصحى. اقرا النص كيما راهو بالضبط.",
};
