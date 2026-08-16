import type { CoachLocale, CoachWorkout } from "@/lib/coach/schemas";

// The weekly plan skeleton (planning.ts) and the safety reductions (safety.ts) emit a
// fixed, finite set of English workout strings. The model's narrative reply is already
// returned in the runner's language, but its workouts are discarded and replaced by this
// skeleton — so the plan would otherwise always read in English. Translate the fixed
// strings deterministically to keep the plan in the selected coach language without an
// extra model call or any risk of the workout distances/dates being altered.
const workoutText: Record<string, { fr: string; ar: string }> = {
  // Titles
  "Long easy run": { fr: "Sortie longue facile", ar: "جَرية طويلة وخفيفة" },
  "Controlled tempo run": { fr: "Sortie tempo contrôlée", ar: "جَرية بريتم مضبوط" },
  "Easy run": { fr: "Sortie facile", ar: "جَرية خفيفة" },
  "Recovery session": { fr: "Séance de récupération", ar: "حصة استرجاع" },
  // Intensity
  "Moderate and controlled": { fr: "Modéré et contrôlé", ar: "متوسط ومضبوط" },
  "Comfortable conversational effort": {
    fr: "Effort confortable, vous pouvez parler",
    ar: "مجهود خفيف تقدر تهدر معاه"
  },
  "Very easy": { fr: "Très facile", ar: "خفيف بزاف" },
  "Easy throughout — never out of breath": {
    fr: "Facile du début à la fin — jamais essoufflé",
    ar: "خفيف من البداية للتالي — ما تلهثش"
  },
  // Instructions
  "Keep the effort controlled. Stop and seek appropriate advice if concerning symptoms appear.": {
    fr: "Gardez un effort contrôlé. Arrêtez-vous et demandez un avis médical si des symptômes inquiétants apparaissent.",
    ar: "خلي المجهود مضبوط. حبس واطلب رأي طبي إذا بانولك أعراض تقلّق."
  },
  "Keep this session very easy. Stop if pain or concerning symptoms appear.": {
    fr: "Gardez cette séance très facile. Arrêtez-vous si une douleur ou des symptômes inquiétants apparaissent.",
    ar: "خلي هاذ الحصة خفيفة بزاف. حبس إذا بان وجع ولا أعراض تقلّق."
  },

  // --- Adaptive planner (Phase 2). Training-phase prefixes, session titles, intensities and
  // instructions. Without these a French or Arabic runner reads an English plan. ---
  // Phase prefixes
  Baseline: { fr: "Reprise", ar: "رجوع تدريجي" },
  Base: { fr: "Base", ar: "بناء القاعدة" },
  Build: { fr: "Développement", ar: "تطوير المستوى" },
  Peak: { fr: "Pic", ar: "أعلى مستوى" },
  Taper: { fr: "Affûtage", ar: "تخفيف" },
  Recovery: { fr: "Récupération", ar: "استرجاع" },
  // Titles
  "Long run": { fr: "Sortie longue", ar: "جَرية طويلة" },
  "Tempo run": { fr: "Sortie tempo", ar: "جَرية تيمبو" },
  Intervals: { fr: "Fractionné", ar: "فترات سريعة" },
  "Recovery jog": { fr: "Footing de récupération", ar: "جَرية استرجاع" },
  "Easy run + strides": { fr: "Sortie facile + accélérations", ar: "جَرية خفيفة + تسارعات قصيرة" },
  // Walk-run (COACHPAR-004): the entry point for a beginner whose BMI puts continuous running at a
  // joint-load disadvantage. The copy has to make the walking sound like training, because it is.
  "Walk-run session": { fr: "Séance marche-course", ar: "حصة مشي وجري" },
  // Intensity
  "Comfortable, conversational effort": {
    fr: "Effort confortable, vous pouvez parler",
    ar: "مجهود خفيف تقدر تهدر معاه"
  },
  "Comfortably hard, controlled": { fr: "Modérément soutenu et contrôlé", ar: "شاق شوية بصح مضبوط" },
  "Hard efforts with easy recovery": {
    fr: "Efforts intenses avec récupération facile",
    ar: "مجهودات قوية وبيناتهم استرجاع خفيف"
  },
  "Relaxed, conversational": { fr: "Détendu, vous pouvez parler", ar: "مرتاح وتقدر تهدر" },
  "Relaxed, with short relaxed pickups": {
    fr: "Détendu, avec de courtes accélérations souples",
    ar: "مرتاح، مع تسارعات قصيرة وساهلة"
  },
  // Instructions
  "Keep it easy and steady — build endurance, not speed. Fuel and hydrate; stop if anything hurts.": {
    fr: "Restez facile et régulier — développez l'endurance, pas la vitesse. Alimentez-vous et hydratez-vous ; arrêtez-vous en cas de douleur.",
    ar: "خلي الريتم خفيف وثابت — الهدف تبني التحمّل، ماشي السرعة. كول واش يكفي واشرب الماء، واحبس إذا حسّيت بوجع."
  },
  "After an easy warm-up, settle into a controlled 'comfortably hard' effort you could just hold a few words at. Easy cool-down.": {
    fr: "Après un échauffement facile, installez-vous sur un effort contrôlé « modérément soutenu », où vous ne pourriez dire que quelques mots. Retour au calme facile.",
    ar: "بعد تسخين خفيف، ادخل في مجهود مضبوط وشاق شوية، وين تقدر تقول غير شوية كلمات. ومن بعد هدّي بشوية."
  },
  "Warm up well, then repeat short hard efforts with easy jog recovery between. Stop the reps if form or breathing falls apart.": {
    fr: "Échauffez-vous bien, puis répétez de courts efforts intenses avec un footing de récupération entre chaque. Arrêtez les répétitions si votre foulée ou votre respiration se dégrade.",
    ar: "سخّن مليح، ومن بعد عاود مجهودات قصيرة وقوية وبيناتهم جَرية استرجاع خفيفة. حبس التكرارات إذا تخربطت حركتك ولا نَفَسك."
  },
  "Fully conversational pace — this is where fitness is built. Slower is fine.": {
    fr: "Une allure où vous pouvez parler sans peine — c'est là que la forme se construit. Plus lent, c'est très bien.",
    ar: "ريتم تقدر تهدر معاه بسهولة — هنا تبني الفورمة. إذا بطّأت ما فيها والو."
  },
  "Gentle and short — the point is to move and recover, not to train.": {
    fr: "Doux et court — l'objectif est de bouger et de récupérer, pas de s'entraîner.",
    ar: "خفيف وقصير — الهدف تتحرّك وترجّع قوتك، ماشي تدير تدريب قوي."
  },
  // Time-target variants (beginners): the minutes live in targetDurationMin, never in the prose, so
  // these stay exact-match translatable.
  "Run for the time shown rather than chasing the distance — the kilometres are just roughly what it works out to. Keep it fully conversational; slower is fine.": {
    fr: "Courez pendant la durée indiquée plutôt que de chercher la distance — les kilomètres ne sont qu'une estimation de ce que cela donne. Restez à une allure où vous pouvez parler ; plus lent, c'est très bien.",
    ar: "اجري المدّة اللي باينة وما تجريش ورا المسافة — الكيلومترات غير تقدير. خليك في ريتم تقدر تهدر معاه؛ وإذا بطّأت ما فيها والو."
  },
  "Jog gently for the time shown — the point is to move and recover, not to train. Distance does not matter here.": {
    fr: "Trottinez doucement pendant la durée indiquée — l'objectif est de bouger et de récupérer, pas de s'entraîner. La distance n'a aucune importance ici.",
    ar: "اجري بشوية المدّة اللي باينة — الهدف تتحرّك وترجّع قوتك، ماشي تدير تدريب قوي. المسافة ما تهمّش هنا."
  },
  "Alternate 2 minutes of easy jogging with 2 minutes of brisk walking, and repeat for the whole session. The walk is part of the training, not a failure — it is what lets you build up week after week without the pounding of continuous running. If the jogging leaves you breathless, make it slower or shorter and walk a little longer.": {
    fr: "Alternez 2 minutes de trot facile et 2 minutes de marche rapide, et répétez pendant toute la séance. La marche fait partie de l'entraînement, ce n'est pas un échec — c'est elle qui vous permet de progresser semaine après semaine sans les chocs de la course continue. Si le trot vous essouffle, ralentissez-le ou raccourcissez-le et marchez un peu plus longtemps.",
    ar: "بدّل بين دقيقتين جري خفيف ودقيقتين مشي سريع، وعاود هكدا طول الحصة. المشي جزء من التدريب، ماشي فشل — هو اللي يخليك تتقدّم سيمانة ورا سيمانة بلا ضغط الجري المتواصل. إذا الجري يقطّعلك النَفَس، هدّيه ولا قصّرو وزيد امشي شوية أكثر."
  },
  "Alternate 2 minutes of easy jogging with 2 minutes of brisk walking for the time shown, and let the distance be whatever it turns out to be. The walk is part of the training, not a failure — it is what lets you build up week after week without the pounding of continuous running. If the jogging leaves you breathless, make it slower or shorter and walk a little longer.": {
    fr: "Alternez 2 minutes de trot facile et 2 minutes de marche rapide pendant la durée indiquée, et laissez la distance être ce qu'elle sera. La marche fait partie de l'entraînement, ce n'est pas un échec — c'est elle qui vous permet de progresser semaine après semaine sans les chocs de la course continue. Si le trot vous essouffle, ralentissez-le ou raccourcissez-le et marchez un peu plus longtemps.",
    ar: "بدّل بين دقيقتين جري خفيف ودقيقتين مشي سريع المدّة اللي باينة، وخلي المسافة تجي كيما جات. المشي جزء من التدريب، ماشي فشل — هو اللي يخليك تتقدّم سيمانة ورا سيمانة بلا ضغط الجري المتواصل. إذا الجري يقطّعلك النَفَس، هدّيه ولا قصّرو وزيد امشي شوية أكثر."
  },
  "Stay out for the time shown and let the distance be whatever it turns out to be — time on your feet is what builds endurance at this stage. Keep it easy and steady, fuel and hydrate, and stop if anything hurts.": {
    fr: "Restez dehors pendant la durée indiquée et laissez la distance être ce qu'elle sera — à ce stade, c'est le temps passé à courir qui construit l'endurance. Restez facile et régulier, alimentez-vous et hydratez-vous, et arrêtez-vous en cas de douleur.",
    ar: "اجري المدّة اللي باينة وخلي المسافة تجي كيما جات — في هاذ المرحلة، الوقت اللي تقضيه تجري هو اللي يبني التحمّل. خلي الريتم خفيف وثابت، كول واش يكفي واشرب الماء، واحبس إذا حسّيت بوجع."
  },
  "Run for the time shown, easy and conversational throughout. In the last third, add 4–6 strides: about 20 seconds of smooth, relaxed speed — fast but never straining — with a full easy jog or walk until you feel recovered between each. This teaches your legs to turn over quickly without the strain of a hard interval session.": {
    fr: "Courez pendant la durée indiquée, facilement et à une allure où vous pouvez parler. Dans le dernier tiers, ajoutez 4 à 6 accélérations : environ 20 secondes de vitesse souple et relâchée — rapide mais jamais en forçant — avec un footing très facile ou de la marche jusqu'à récupération complète entre chacune. Cela apprend à vos jambes à tourner vite sans la contrainte d'une vraie séance de fractionné.",
    ar: "اجري المدّة اللي باينة بريتم خفيف تقدر تهدر معاه كامل الحصة. في الثلث الأخير، زيد 4 حتى 6 تسارعات: قرابة 20 ثانية سرعة ساهلة ومرتاح فيها — سريعة بلا ما تعيّي روحك — وبين كل تسارع اجري بشوية ولا امشي حتى يرجع نَفَسك مليح. هكدا تعوّد رجليك على الحركة السريعة بلا تعب حصة الفترات القوية."
  },
  "Run the whole session easy and conversational. In the last third, add 4–6 strides: about 20 seconds of smooth, relaxed speed — fast but never straining — with a full easy jog or walk until you feel recovered between each. This teaches your legs to turn over quickly without the strain of a hard interval session.": {
    fr: "Courez toute la séance facilement, à une allure où vous pouvez parler. Dans le dernier tiers, ajoutez 4 à 6 accélérations : environ 20 secondes de vitesse souple et relâchée — rapide mais jamais en forçant — avec un footing très facile ou de la marche jusqu'à récupération complète entre chacune. Cela apprend à vos jambes à tourner vite sans la contrainte d'une vraie séance de fractionné.",
    ar: "خلي الحصة كاملة خفيفة وبريتم تقدر تهدر معاه. في الثلث الأخير، زيد 4 حتى 6 تسارعات: قرابة 20 ثانية سرعة ساهلة ومرتاح فيها — سريعة بلا ما تعيّي روحك — وبين كل تسارع اجري بشوية ولا امشي حتى يرجع نَفَسك مليح. هكدا تعوّد رجليك على الحركة السريعة بلا تعب حصة الفترات القوية."
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
