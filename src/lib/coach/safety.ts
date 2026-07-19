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

const dangerPatterns = [
  /chest pain|faint(?:ed|ing)?|difficulty breathing|severe shortness of breath/i,
  /douleur (?:à la |de )?poitrine|évanoui|évanouissement|difficulté à respirer|essoufflement sévère/i,
  /ألم الصدر|اغماء|إغماء|صعوبة في التنفس|ضيق تنفس شديد/i
];

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
    followUpQuestion: null
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
