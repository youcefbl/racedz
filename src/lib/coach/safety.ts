import type { CoachMetrics } from "@/lib/coach/metrics";
import type { CoachResponse, CoachWorkout } from "@/lib/coach/schemas";

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

export function enforceCoachSafety(
  response: CoachResponse,
  decision: CoachSafetyDecision,
  skeleton: CoachWorkout[]
): CoachResponse {
  const upcomingWorkouts = skeleton.map((safeWorkout) => {
    return decision.level === "CAUTION" ? reduceWorkout(safeWorkout) : safeWorkout;
  });

  const warningSignals = [...new Set([...decision.reasons, ...response.warningSignals])].slice(0, 6);

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
    warningSignals: decision.reasons,
    nextWorkout: null,
    upcomingWorkouts: [],
    recoveryAdvice: [copy],
    requiresProfessionalAdvice: true
  };
}

function reduceWorkout(workout: CoachWorkout): CoachWorkout {
  return {
    ...workout,
    workoutType: workout.workoutType === "REST" ? "REST" : "RECOVERY",
    title: workout.workoutType === "REST" ? workout.title : "Recovery session",
    targetDistanceKm: workout.targetDistanceKm === null ? null : Math.round(workout.targetDistanceKm * 5) / 10,
    targetDurationMin: workout.targetDurationMin === null ? null : Math.min(workout.targetDurationMin, 30),
    intensity: "Very easy",
    instructions: "Keep this session very easy. Stop if pain or concerning symptoms appear."
  };
}
