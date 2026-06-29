import type { CoachLocale, CoachWorkout } from "@/lib/coach/schemas";

// The weekly plan skeleton (planning.ts) and the safety reductions (safety.ts) emit a
// fixed, finite set of English workout strings. The model's narrative reply is already
// returned in the runner's language, but its workouts are discarded and replaced by this
// skeleton — so the plan would otherwise always read in English. Translate the fixed
// strings deterministically to keep the plan in the selected coach language without an
// extra model call or any risk of the workout distances/dates being altered.
const workoutText: Record<string, { fr: string; ar: string }> = {
  // Titles
  "Long easy run": { fr: "Sortie longue facile", ar: "جري طويل سهل" },
  "Controlled tempo run": { fr: "Tempo contrôlé", ar: "جري تيمبو محكوم" },
  "Easy run": { fr: "Sortie facile", ar: "جري سهل" },
  "Recovery session": { fr: "Séance de récupération", ar: "جلسة استشفاء" },
  // Intensity
  "Moderate and controlled": { fr: "Modérée et contrôlée", ar: "معتدلة ومضبوطة" },
  "Comfortable conversational effort": {
    fr: "Effort confortable, on peut parler",
    ar: "مجهود مريح يسمح بالحديث"
  },
  "Very easy": { fr: "Très facile", ar: "سهلة جداً" },
  // Instructions
  "Keep the effort controlled. Stop and seek appropriate advice if concerning symptoms appear.": {
    fr: "Gardez un effort contrôlé. Arrêtez-vous et demandez un avis approprié si des symptômes inquiétants apparaissent.",
    ar: "حافظ على مجهود محكوم. توقّف واطلب استشارة مناسبة إذا ظهرت أعراض مقلقة."
  },
  "Keep this session very easy. Stop if pain or concerning symptoms appear.": {
    fr: "Gardez cette séance très facile. Arrêtez-vous si une douleur ou des symptômes inquiétants apparaissent.",
    ar: "اجعل هذه الجلسة سهلة جداً. توقّف إذا ظهر ألم أو أعراض مقلقة."
  }
};

function translate(value: string, locale: "fr" | "ar"): string {
  return workoutText[value]?.[locale] ?? value;
}

export function localizeWorkout(workout: CoachWorkout, locale: CoachLocale): CoachWorkout {
  if (locale === "en") return workout;
  return {
    ...workout,
    title: translate(workout.title, locale),
    intensity: translate(workout.intensity, locale),
    instructions: translate(workout.instructions, locale)
  };
}
