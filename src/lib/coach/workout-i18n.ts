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
  "Controlled tempo run": { fr: "Sortie tempo contrôlée", ar: "جري بإيقاع مضبوط" },
  "Easy run": { fr: "Sortie facile", ar: "جري سهل" },
  "Recovery session": { fr: "Séance de récupération", ar: "جلسة استشفاء" },
  // Intensity
  "Moderate and controlled": { fr: "Modéré et contrôlé", ar: "معتدل ومضبوط" },
  "Comfortable conversational effort": {
    fr: "Effort confortable, vous pouvez parler",
    ar: "مجهود مريح يسمح لك بالحديث"
  },
  "Very easy": { fr: "Très facile", ar: "سهل جدًا" },
  // Instructions
  "Keep the effort controlled. Stop and seek appropriate advice if concerning symptoms appear.": {
    fr: "Gardez un effort contrôlé. Arrêtez-vous et demandez un avis médical si des symptômes inquiétants apparaissent.",
    ar: "حافظ على مجهود مضبوط. توقّف واطلب استشارة طبية إذا ظهرت أعراض مقلقة."
  },
  "Keep this session very easy. Stop if pain or concerning symptoms appear.": {
    fr: "Gardez cette séance très facile. Arrêtez-vous si une douleur ou des symptômes inquiétants apparaissent.",
    ar: "اجعل هذه الحصة سهلة جدًا. توقّف إذا ظهر ألم أو أي أعراض مقلقة."
  },

  // --- Adaptive planner (Phase 2). Training-phase prefixes, session titles, intensities and
  // instructions. Without these a French or Arabic runner reads an English plan. ---
  // Phase prefixes
  Baseline: { fr: "Reprise", ar: "تأسيس" },
  Base: { fr: "Base", ar: "بناء القاعدة" },
  Build: { fr: "Développement", ar: "تطوير" },
  Peak: { fr: "Pic", ar: "الذروة" },
  Taper: { fr: "Affûtage", ar: "تخفيف" },
  Recovery: { fr: "Récupération", ar: "استشفاء" },
  // Titles
  "Long run": { fr: "Sortie longue", ar: "جري طويل" },
  "Tempo run": { fr: "Sortie tempo", ar: "جري بإيقاع" },
  Intervals: { fr: "Fractionné", ar: "تدريب متقطع" },
  "Recovery jog": { fr: "Footing de récupération", ar: "هرولة استشفاء" },
  "Easy run + strides": { fr: "Sortie facile + accélérations", ar: "جري سهل + تسارعات قصيرة" },
  // Intensity
  "Comfortable, conversational effort": {
    fr: "Effort confortable, vous pouvez parler",
    ar: "مجهود مريح يسمح لك بالحديث"
  },
  "Comfortably hard, controlled": { fr: "Modérément soutenu et contrôlé", ar: "صعب نسبيًا ومضبوط" },
  "Hard efforts with easy recovery": {
    fr: "Efforts intenses avec récupération facile",
    ar: "مجهودات قوية مع استشفاء سهل"
  },
  "Relaxed, conversational": { fr: "Détendu, vous pouvez parler", ar: "مسترخٍ ويسمح بالحديث" },
  "Relaxed, with short relaxed pickups": {
    fr: "Détendu, avec de courtes accélérations souples",
    ar: "مسترخٍ مع تسارعات قصيرة وسلسة"
  },
  // Instructions
  "Keep it easy and steady — build endurance, not speed. Fuel and hydrate; stop if anything hurts.": {
    fr: "Restez facile et régulier — développez l'endurance, pas la vitesse. Alimentez-vous et hydratez-vous ; arrêtez-vous en cas de douleur.",
    ar: "حافظ على وتيرة سهلة وثابتة — الهدف بناء التحمّل لا السرعة. تناول ما يكفي من الطعام والماء، وتوقّف إذا شعرت بأي ألم."
  },
  "After an easy warm-up, settle into a controlled 'comfortably hard' effort you could just hold a few words at. Easy cool-down.": {
    fr: "Après un échauffement facile, installez-vous sur un effort contrôlé « modérément soutenu », où vous ne pourriez dire que quelques mots. Retour au calme facile.",
    ar: "بعد إحماء سهل، انتقل إلى مجهود مضبوط «صعب نسبيًا» بحيث تستطيع نطق بضع كلمات فقط. ثم تهدئة سهلة."
  },
  "Warm up well, then repeat short hard efforts with easy jog recovery between. Stop the reps if form or breathing falls apart.": {
    fr: "Échauffez-vous bien, puis répétez de courts efforts intenses avec un footing de récupération entre chaque. Arrêtez les répétitions si votre foulée ou votre respiration se dégrade.",
    ar: "قم بإحماء جيد، ثم كرّر مجهودات قصيرة وقوية مع هرولة استشفاء بينها. أوقف التكرارات إذا اختلّ أداؤك أو تنفسك."
  },
  "Fully conversational pace — this is where fitness is built. Slower is fine.": {
    fr: "Une allure où vous pouvez parler sans peine — c'est là que la forme se construit. Plus lent, c'est très bien.",
    ar: "وتيرة تسمح لك بالحديث بسهولة — هنا تُبنى اللياقة. الأبطأ جيد تمامًا."
  },
  "Gentle and short — the point is to move and recover, not to train.": {
    fr: "Doux et court — l'objectif est de bouger et de récupérer, pas de s'entraîner.",
    ar: "خفيف وقصير — الهدف هو الحركة والاستشفاء، لا التدريب."
  },
  "Run the whole session easy and conversational. In the last third, add 4–6 strides: about 20 seconds of smooth, relaxed speed — fast but never straining — with a full easy jog or walk until you feel recovered between each. This teaches your legs to turn over quickly without the strain of a hard interval session.": {
    fr: "Courez toute la séance facilement, à une allure où vous pouvez parler. Dans le dernier tiers, ajoutez 4 à 6 accélérations : environ 20 secondes de vitesse souple et relâchée — rapide mais jamais en forçant — avec un footing très facile ou de la marche jusqu'à récupération complète entre chacune. Cela apprend à vos jambes à tourner vite sans la contrainte d'une vraie séance de fractionné.",
    ar: "اجعل الحصة كلها سهلة وبوتيرة تسمح بالحديث. في الثلث الأخير، أضف 4 إلى 6 تسارعات: نحو 20 ثانية من السرعة السلسة والمسترخية — سريعة دون إجهاد — مع هرولة سهلة أو مشي حتى تستعيد أنفاسك تمامًا بين كل تسارع. هذا يعوّد ساقيك على التردد السريع دون إرهاق حصة التدريب المتقطع الشاقة."
  }
};

function translate(value: string, locale: "fr" | "ar"): string {
  return workoutText[value]?.[locale] ?? value;
}

// The adaptive planner prefixes titles with a training phase ("Base · Long run"), so translate each
// side of the separator independently — looking the composite up whole would always miss and leave
// French and Arabic runners reading an English plan.
function translateTitle(value: string, locale: "fr" | "ar"): string {
  const separator = " · ";
  if (!value.includes(separator)) return translate(value, locale);
  return value
    .split(separator)
    .map((part) => translate(part, locale))
    .join(separator);
}

// Generic in the workout type so planner-only fields (e.g. targetPaceSecondsPerKm) survive
// localization instead of being narrowed away.
export function localizeWorkout<T extends CoachWorkout>(workout: T, locale: CoachLocale): T {
  if (locale === "en") return workout;
  return {
    ...workout,
    title: translateTitle(workout.title, locale),
    intensity: translate(workout.intensity, locale),
    instructions: translate(workout.instructions, locale)
  };
}
