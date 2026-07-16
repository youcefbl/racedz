import type { CoachLocale } from "@/components/coach/types";
import type { AudioCueEvent, AudioProfileId } from "@/lib/coach/audio-coaching";

// Spoken cue phrases for the audio coach (audio-coaching plan, Phase B), en/fr/ar. Written to be
// SPOKEN, not read: short sentences, digits (every TTS engine reads digits well in its language),
// warm and never punitive — the same supportive tone as the rest of the coach. Arabic is MSA,
// kept simple; the Darija-leaning review pass happens with a native speaker before release.

// "5 minutes 42" / "42 seconds" — how a duration is said out loud.
export function spokenDuration(totalSeconds: number, locale: CoachLocale): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (locale === "fr") {
    if (minutes === 0) return `${seconds} secondes`;
    return seconds === 0 ? `${minutes} minutes` : `${minutes} minutes ${seconds}`;
  }
  if (locale === "ar") {
    if (minutes === 0) return `${seconds} ثانية`;
    return seconds === 0 ? `${minutes} دقيقة` : `${minutes} دقيقة و${seconds} ثانية`;
  }
  if (minutes === 0) return `${seconds} seconds`;
  return seconds === 0 ? `${minutes} minutes` : `${minutes} minutes ${seconds}`;
}

// Phrase pools: rotated by the scheduler's counter so long sessions don't repeat one line.
const CHECK_INS: Record<CoachLocale, string[]> = {
  en: [
    "Nice and relaxed. This is how recovery should feel.",
    "Easy does it. You're building, not testing.",
    "Stay comfortable. Breathing easy is the goal today."
  ],
  fr: [
    "Bien relâché. C'est exactement ça, la récupération.",
    "Tout en douceur. Aujourd'hui on construit, on ne teste pas.",
    "Restez à l'aise. L'objectif du jour, c'est de respirer facilement."
  ],
  ar: [
    "استرخِ وخفف الإيقاع. هكذا يكون الجري الاستشفائي.",
    "بهدوء. اليوم نبني القوة، لا نختبرها.",
    "ابقَ مرتاحًا. الهدف اليوم تنفس سهل."
  ]
};

const FORM_CUES: Record<CoachLocale, string[]> = {
  en: [
    "Tall posture, quick light steps.",
    "Relax your shoulders, smooth and fast.",
    "Drive with your arms, stay light on your feet.",
    "Fast but relaxed. Never forced."
  ],
  fr: [
    "Posture haute, appuis rapides et légers.",
    "Relâchez les épaules, souple et rapide.",
    "Utilisez vos bras, restez léger sur vos appuis.",
    "Vite mais relâché. Jamais forcé."
  ],
  ar: [
    "قامة مستقيمة وخطوات خفيفة وسريعة.",
    "أرخِ كتفيك، انسيابية وسرعة.",
    "حرّك ذراعيك وابقَ خفيفًا على قدميك.",
    "سريع لكن مسترخٍ. من دون إجبار."
  ]
};

// "Slow down" phrased for the session's intent: recovery protects the easy day, threshold
// protects control, the rest is a gentle ease-off.
function slowerText(profileId: AudioProfileId, locale: CoachLocale): string {
  if (profileId === "RECOVERY") {
    if (locale === "fr") return "Ralentissez. C'est une sortie de récupération, tout doit rester facile.";
    if (locale === "ar") return "خفف السرعة. هذا جري استشفائي، يجب أن يبقى سهلًا.";
    return "Slow down. This is a recovery run, keep it truly easy.";
  }
  if (profileId === "THRESHOLD") {
    if (locale === "fr") return "Trop rapide. Relâchez un peu, restez en contrôle.";
    if (locale === "ar") return "أسرع من اللازم. تمهل قليلًا وابقَ متحكمًا.";
    return "Too fast. Back off a little, stay controlled.";
  }
  if (locale === "fr") return "Un peu rapide. Relâchez légèrement.";
  if (locale === "ar") return "أسرع قليلًا من اللازم. خفف الإيقاع.";
  return "A little fast. Ease off slightly.";
}

function fasterText(locale: CoachLocale): string {
  if (locale === "fr") return "Un peu lent. Accélérez légèrement.";
  if (locale === "ar") return "أبطأ قليلًا من اللازم. زد السرعة قليلًا.";
  return "A touch slow. Pick it up a little.";
}

/** The spoken sentence for one cue event. */
export function audioCueText(event: AudioCueEvent, profileId: AudioProfileId, locale: CoachLocale): string {
  switch (event.kind) {
    case "split": {
      const split = spokenDuration(event.splitSec, locale);
      if (locale === "fr") return `Kilomètre ${event.km}. ${split}.`;
      if (locale === "ar") return `الكيلومتر ${event.km}. ${split}.`;
      return `Kilometre ${event.km}. ${split}.`;
    }
    case "repSplit": {
      const time = spokenDuration(event.seconds, locale);
      if (locale === "fr") return `Fraction terminée en ${time}.`;
      if (locale === "ar") return `أنهيت التكرار في ${time}.`;
      return `Rep done in ${time}.`;
    }
    case "pace":
      return event.direction === "slower" ? slowerText(profileId, locale) : fasterText(locale);
    case "checkIn": {
      const pool = CHECK_INS[locale];
      return pool[event.index % pool.length]!;
    }
    case "form": {
      const pool = FORM_CUES[locale];
      return pool[event.index % pool.length]!;
    }
    case "hydrate":
      if (locale === "fr") return "Pensez à boire si vous le pouvez.";
      if (locale === "ar") return "اشرب ماء إن استطعت.";
      return "Take a drink if you can.";
    case "halfway":
      if (locale === "fr") return "Mi-parcours. Vous gérez très bien.";
      if (locale === "ar") return "منتصف المسافة. أداؤك ممتاز.";
      return "Halfway there. You're doing great.";
    case "lastKm":
      if (locale === "fr") return "Dernier kilomètre. Terminez en beauté.";
      if (locale === "ar") return "آخر كيلومتر. أنهِ بقوة.";
      return "Last kilometre. Finish strong.";
    case "oneMinuteLeft":
      if (locale === "fr") return "Encore une minute. Tenez bon.";
      if (locale === "ar") return "دقيقة واحدة متبقية. اثبت.";
      return "One minute left. Hold it there.";
    case "midStep":
      if (locale === "fr") return "Mi-fraction. Restez en contrôle, ne forcez pas.";
      if (locale === "ar") return "منتصف التكرار. ابقَ متحكمًا ولا تندفع.";
      return "Halfway through the rep. Stay controlled, don't push.";
    case "lastRep":
      if (locale === "fr") return "Dernière fraction. Donnez tout, proprement.";
      if (locale === "ar") return "آخر تكرار. قدّم أفضل ما عندك.";
      return "Last one. Make it count.";
    case "warmupTip":
      if (locale === "fr") return "Commencez tout doucement. Laissez le corps monter en température.";
      if (locale === "ar") return "ابدأ بهدوء تام. دع جسمك يسخن تدريجيًا.";
      return "Start nice and gentle. Let your body warm up gradually.";
    case "warmupLastMinute":
      if (locale === "fr") return "Encore une minute d'échauffement. Préparez-vous à travailler.";
      if (locale === "ar") return "دقيقة واحدة من الإحماء. استعد للجهد.";
      return "One minute of warm-up left. Get ready to work.";
    case "cooldownTip":
      if (locale === "fr") return "Bien joué. Relâchez complètement et laissez la respiration se calmer.";
      if (locale === "ar") return "أحسنت. أرخِ إيقاعك تمامًا ودع تنفسك يهدأ.";
      return "Well done. Ease right off and let your breathing settle.";
  }
}
