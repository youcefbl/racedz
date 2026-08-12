import type { PlannedWorkout } from "@/lib/coach/adaptive-planner";
import type { CoachMetrics } from "@/lib/coach/metrics";
import type { CoachLocale, CoachResponse, CoachWorkout } from "@/lib/coach/schemas";
import { localizeWorkout } from "@/lib/coach/workout-i18n";

// The safety-enforced response always carries the deterministic skeleton's workouts, so its sessions
// keep the planner's numeric pace targets — which the model never sees and cannot invent.
export type EnforcedCoachResponse = CoachResponse & {
  upcomingWorkouts: PlannedWorkout[];
  nextWorkout: PlannedWorkout | null;
};

export type CoachSafetyDecision = {
  level: "CLEAR" | "CAUTION" | "BLOCKED";
  reasons: string[];
  requiresProfessionalAdvice: boolean;
};

type SafetyRun = {
  painLevel: number;
  fatigueLevel: number;
  symptoms: string | null;
  notes: string | null;
} | null;

type SafetyProfile = {
  chronicConditions?: string[] | null;
} | null;

// Conditions that warrant a more conservative plan and a clear professional-clearance recommendation.
const cautionConditions = new Set(["ASTHMA", "DIABETES", "HYPERTENSION", "THYROID", "ANEMIA", "OTHER"]);
const clearanceConditions = new Set(["HEART_CONDITION"]);

// Urgent red-flag symptom patterns, scanned over runner free text (run symptoms/notes, goal injury
// notes, and the live chat message — see containsUrgentSymptomText). Kept deliberately narrow:
// a false BLOCK erodes trust, and the taxonomy beyond clear cardio/heat emergencies is pending the
// owner-reviewed safety wording (coach_review_fable_codex.md §7 Q3). EN + FR + Arabic script +
// common Latin-script darija (arabizi) transliterations.
const dangerPatterns = [
  /chest pain|faint(?:ed|ing)?|passed out|difficulty breathing|severe shortness of breath|heat ?stroke/i,
  /douleur (?:à la |de |dans la )?poitrine|évanoui|évanouissement|difficulté à respirer|essoufflement sévère|coup de chaleur|perte de connaissance/i,
  /(?:ألم|وجع|أوجاع)\s*(?:في|فى)?\s*(?:ال)?صدر|صدري\s*(?:يوجعني|يؤلمني)|اغماء|إغماء|أغمي|صعوبة في التنفس|ضيق تنفس شديد|ضربة شمس/,
  // Arabizi / Latin-script darija. Each alternative pairs a pain/failure word with a body signal so
  // ordinary training talk ("sder" as a route name, "nefs" as motivation) cannot trip it alone.
  /(?:wja3|wje3|oja3|ouja3)\s*(?:f[iy]?\s*)?(?:s|ss)?(?:der|dar|adr)i?|\bgh?mit\b|\bghomit\b|ma\s*(?:nejem|njem|n9der|nekder|nakder)(?:ch|sh)?\s*(?:n[ae]tn[ae]f+[ae]s)/i
];

/**
 * Deterministic urgent-symptom scan for a single piece of runner-authored free text (the live chat
 * message, a sleep note, a goal edit). Used as a preflight so acute red flags are blocked BEFORE
 * topicality, entitlement, and any model call — a runner typing "I fainted and have chest pain"
 * must get the escalation response even when off-topic by vocabulary or over quota.
 */
export function containsUrgentSymptomText(text: string | null | undefined): boolean {
  const trimmed = text?.trim();
  if (!trimmed) return false;
  return dangerPatterns.some((pattern) => pattern.test(trimmed));
}

/** The blocked decision a positive urgent-text preflight produces; reuses the translated reason. */
export function urgentSymptomDecision(): CoachSafetyDecision {
  return {
    level: "BLOCKED",
    reasons: ["A reported symptom requires professional assessment."],
    requiresProfessionalAdvice: true
  };
}

export function evaluateCoachSafety(run: SafetyRun, metrics: CoachMetrics, profile?: SafetyProfile): CoachSafetyDecision {
  const text = `${run?.symptoms ?? ""} ${run?.notes ?? ""}`.trim();
  const reasons: string[] = [];

  if (dangerPatterns.some((pattern) => pattern.test(text))) reasons.push("A reported symptom requires professional assessment.");
  if ((run?.painLevel ?? 0) >= 7) reasons.push("The reported pain level is severe.");

  if (reasons.length > 0) {
    return { level: "BLOCKED", reasons, requiresProfessionalAdvice: true };
  }

  const conditions = profile?.chronicConditions ?? [];
  const needsClearance = conditions.some((condition) => clearanceConditions.has(condition));
  if (needsClearance) reasons.push("A reported heart condition requires medical clearance before intense training.");
  if (conditions.some((condition) => cautionConditions.has(condition))) {
    reasons.push("An ongoing health condition was reported; keep training conservative.");
  }

  if ((run?.painLevel ?? metrics.maximumPainLast7Days) >= 4) reasons.push("Pain was reported during recent training.");
  if ((run?.fatigueLevel ?? metrics.maximumFatigueLast7Days) >= 8) reasons.push("Recent fatigue is high.");
  if ((metrics.weeklyDistanceChangePercent ?? 0) > 20) reasons.push("Recent weekly distance increased sharply.");

  return {
    level: reasons.length > 0 ? "CAUTION" : "CLEAR",
    reasons,
    requiresProfessionalAdvice: needsClearance || reasons.some((reason) => reason.includes("Pain"))
  };
}

// Safety reasons are generated in English (stored on the interaction for admin/debug), but the
// runner sees them as warningSignals — so translate them for display. Keyed by the exact English
// string each check pushes; unknown strings fall back to English.
const SAFETY_REASON_I18N: Record<string, { fr: string; ar: string }> = {
  "A reported symptom requires professional assessment.": {
    fr: "Un symptôme signalé nécessite l'avis d'un professionnel de santé.",
    ar: "يتطلب أحد الأعراض المُبلَّغ عنها تقييمًا من مختص صحي."
  },
  "The reported pain level is severe.": {
    fr: "Le niveau de douleur signalé est élevé.",
    ar: "مستوى الألم المُبلَّغ عنه مرتفع."
  },
  "A reported heart condition requires medical clearance before intense training.": {
    fr: "Un problème cardiaque signalé nécessite un avis médical avant tout entraînement intense.",
    ar: "تتطلب حالة قلبية مُبلَّغ عنها استشارة طبية قبل أي تدريب مكثّف."
  },
  "An ongoing health condition was reported; keep training conservative.": {
    fr: "Un problème de santé persistant a été signalé ; restez prudent dans votre entraînement.",
    ar: "تم الإبلاغ عن حالة صحية مستمرة؛ لذا احرص على أن يكون تدريبك متحفّظًا."
  },
  "Pain was reported during recent training.": {
    fr: "Des douleurs ont été signalées lors d'entraînements récents.",
    ar: "تم الإبلاغ عن آلام خلال التدريبات الأخيرة."
  },
  "Recent fatigue is high.": {
    fr: "La fatigue récente est importante.",
    ar: "مستوى التعب الأخير مرتفع."
  },
  "Recent weekly distance increased sharply.": {
    fr: "La distance hebdomadaire a fortement augmenté récemment.",
    ar: "ازدادت المسافة الأسبوعية كثيرًا مؤخرًا."
  }
};

function localizeReasons(reasons: string[], locale: CoachLocale): string[] {
  if (locale === "en") return reasons;
  return reasons.map((reason) => SAFETY_REASON_I18N[reason]?.[locale] ?? reason);
}

/**
 * `usedSignals` and `dataGaps`, localized the same way — and for the same reason.
 *
 * Field test 20260812-01 found an Arabic reply whose "based on" footer read
 * `runner question · goal · active plan · consistency`, and a second reply in the same run whose
 * gaps came back in Arabic while another's came back in English. Both fields are model-authored
 * free text, so asking the model to translate them produced exactly that inconsistency.
 *
 * The fix is to stop asking. The prompt now pins both fields to a closed English vocabulary, and
 * the mapping to the runner's language happens here, deterministically. Unknown strings fall
 * through unchanged, so a model that invents a signal degrades to English rather than to nothing.
 */
const SIGNAL_I18N: Record<string, { fr: string; ar: string }> = {
  goal: { fr: "objectif", ar: "الهدف" },
  "active plan": { fr: "plan en cours", ar: "البرنامج الحالي" },
  "recent runs": { fr: "sorties récentes", ar: "الجريات الأخيرة" },
  "recent pace": { fr: "allure récente", ar: "الوتيرة الأخيرة" },
  adherence: { fr: "assiduité", ar: "الانتظام" },
  consistency: { fr: "régularité", ar: "المواظبة" },
  sleep: { fr: "sommeil", ar: "النوم" },
  weather: { fr: "météo", ar: "الطقس" },
  "analysed run": { fr: "sortie analysée", ar: "الجرية المحلَّلة" },
  "chronic condition": { fr: "problème de santé chronique", ar: "حالة صحية مزمنة" },
  "runner question": { fr: "question du coureur", ar: "سؤال العدّاء" },
  "safety decision": { fr: "décision de sécurité", ar: "قرار السلامة" },
  "coach memory": { fr: "mémoire du coach", ar: "ذاكرة المدرب" }
};

const GAP_I18N: Record<string, { fr: string; ar: string }> = {
  "no recent runs": { fr: "aucune sortie récente", ar: "ما كاش جريات أخيرة" },
  "no recent pace": { fr: "aucune allure récente", ar: "ما كاش وتيرة أخيرة" },
  "no sleep logged": { fr: "aucun sommeil enregistré", ar: "ما كاش نوم مسجّل" },
  "no target race": { fr: "aucune course cible", ar: "ما كاش سباق مستهدف" },
  "no weather data": { fr: "aucune donnée météo", ar: "ما كاش معطيات الطقس" },
  "no heart-condition details": {
    fr: "aucun détail sur le problème cardiaque",
    ar: "ما كاش تفاصيل على الحالة القلبية"
  },
  "no symptom details": { fr: "aucun détail sur les symptômes", ar: "ما كاش تفاصيل على الأعراض" },
  "no injury details": { fr: "aucun détail sur la blessure", ar: "ما كاش تفاصيل على الإصابة" }
};

function localizeVocabulary(
  values: string[],
  table: Record<string, { fr: string; ar: string }>,
  locale: CoachLocale
): string[] {
  if (locale === "en") return values;
  return values.map((value) => table[value.trim().toLowerCase()]?.[locale] ?? value);
}

export function enforceCoachSafety(
  response: CoachResponse,
  decision: CoachSafetyDecision,
  // Accepts both the adaptive planner's paced sessions and the older flat skeleton, which carries no
  // pace at all — normalized to an explicit null here rather than making callers fake the field.
  skeleton: ReadonlyArray<CoachWorkout & Partial<Pick<PlannedWorkout, "targetPaceSecondsPerKm">>>,
  locale: CoachLocale
): EnforcedCoachResponse {
  const upcomingWorkouts = skeleton.map((entry) => {
    const paced: PlannedWorkout = { ...entry, targetPaceSecondsPerKm: entry.targetPaceSecondsPerKm ?? null };
    const workout = decision.level === "CAUTION" ? reduceWorkout(paced) : paced;
    return localizeWorkout(workout, locale);
  });

  const warningSignals = [...new Set([...localizeReasons(decision.reasons, locale), ...response.warningSignals])].slice(0, 6);

  return {
    ...response,
    warningSignals,
    usedSignals: localizeVocabulary(response.usedSignals, SIGNAL_I18N, locale),
    dataGaps: localizeVocabulary(response.dataGaps, GAP_I18N, locale),
    upcomingWorkouts,
    nextWorkout: upcomingWorkouts[0] ?? null,
    requiresProfessionalAdvice: response.requiresProfessionalAdvice || decision.requiresProfessionalAdvice
  };
}

export function buildBlockedCoachResponse(decision: CoachSafetyDecision, locale: "en" | "fr" | "ar"): CoachResponse {
  const copy = {
    en: "Training advice is paused because the information provided needs professional assessment.",
    fr: "Les conseils d'entraînement sont suspendus car les informations fournies nécessitent une évaluation professionnelle.",
    ar: "تم إيقاف نصائح التدريب لأن المعلومات المقدمة تحتاج إلى تقييم من مختص."
  }[locale];

  return {
    summary: copy,
    progressAssessment: copy,
    positiveSignals: [],
    warningSignals: localizeReasons(decision.reasons, locale),
    nextWorkout: null,
    upcomingWorkouts: [],
    recoveryAdvice: [copy],
    requiresProfessionalAdvice: true,
    usedSignals: [],
    dataGaps: [],
    followUpQuestion: null,
    memoryCandidates: []
  };
}

function reduceWorkout(workout: PlannedWorkout): PlannedWorkout {
  return {
    ...workout,
    workoutType: workout.workoutType === "REST" ? "REST" : "RECOVERY",
    title: workout.workoutType === "REST" ? workout.title : "Recovery session",
    targetDistanceKm: workout.targetDistanceKm === null ? null : Math.round(workout.targetDistanceKm * 5) / 10,
    targetDurationMin: workout.targetDurationMin === null ? null : Math.min(workout.targetDurationMin, 30),
    // Drop the pace target entirely. A reduced session was a tempo or interval a moment ago, and
    // spreading its pace through would prescribe fast running to a runner we just told to go very
    // easy. "Very easy" is the instruction; any number here would only argue with it.
    targetPaceSecondsPerKm: null,
    intensity: "Very easy",
    instructions: "Keep this session very easy. Stop if pain or concerning symptoms appear."
  };
}
