import { z } from "zod";
import { coachResponseSchema, type CoachResponse } from "@/lib/coach/schemas";
import type { buildRunnerCoachContext } from "@/lib/coach/context";

// Generate language, not deterministic workouts or duplicate compatibility fields. The public
// response DTO stays unchanged; only the private provider contract is smaller.
export const coachChatProviderSchema = coachResponseSchema.pick({
  responseMode: true, summary: true, nextAction: true, quickReplies: true,
  warningSignals: true, requiresProfessionalAdvice: true, usedSignalKeys: true,
  missingSignalKeys: true, followUpQuestion: true, memoryCandidates: true
}).extend({ summary: z.string().min(1).max(800), warningSignals: z.array(z.string().min(1).max(300)).max(3) });

export const coachReviewProviderSchema = coachChatProviderSchema.extend({
  progressAssessment: z.string().min(1).max(600),
  positiveSignals: z.array(z.string().min(1).max(200)).max(3),
  recoveryAdvice: z.array(z.string().min(1).max(200)).max(2)
});

export type ProviderCoachReply = z.infer<typeof coachChatProviderSchema> &
  Partial<Pick<CoachResponse, "progressAssessment" | "positiveSignals" | "recoveryAdvice">>;

export const providerSchemaFor = (type: string) => type === "CHAT" ? coachChatProviderSchema : coachReviewProviderSchema;

/** Ground provenance chips in the EXACT selected/compacted context, not the pre-selection inputs.
 * This checks source availability, not the truth of arbitrary model prose; quality evals still matter.
 */
export function assembleProviderReply(reply: ProviderCoachReply, context: ReturnType<typeof buildRunnerCoachContext>): CoachResponse {
  const goal = context.goal;
  const hasHealth = Boolean(goal.injuryNotes || goal.injuryHistory || goal.healthNotes || goal.chronicConditions.length);
  const available: Record<CoachResponse["usedSignalKeys"][number], boolean> = {
    GOAL: true, ACTIVE_PLAN: context.activePlan !== null,
    RECENT_RUNS: context.recentRuns.length > 0,
    PLAN_ADHERENCE: Boolean(context.planAdherence?.hasActivePlan), CONSISTENCY: context.consistency !== null,
    SLEEP: context.sleep !== null, WEATHER: context.environment !== null || context.analysedRun?.weather != null,
    ANALYSED_RUN: context.analysedRun !== null, RUNNER_QUESTION: Boolean(context.request.runnerQuestion),
    HEALTH_CONTEXT: hasHealth, SAFETY_DECISION: true, COACH_MEMORY: Boolean(context.coachMemory?.length)
  };
  const omitted = new Set(context.selection.omittedForRelevance);
  const trimmed = new Set(context.selection.trimmedSections);
  const missing: Record<CoachResponse["missingSignalKeys"][number], boolean> = {
    NO_RECENT_RUNS: !available.RECENT_RUNS && !omitted.has("recentRuns") && !trimmed.has("recentRuns"),
    NO_RECENT_PACE: context.computedMetrics.averagePaceLast28DaysSecondsPerKm == null,
    NO_SLEEP_LOGGED: !available.SLEEP && !omitted.has("sleep"),
    NO_TARGET_RACE: context.targetRace === null && !omitted.has("targetRace") && !trimmed.has("targetRace"),
    NO_WEATHER_DATA: !available.WEATHER && !omitted.has("forecast"),
    NO_HEALTH_DETAILS: !hasHealth,
    NO_SYMPTOM_DETAILS: !context.analysedRun?.symptoms && !context.recentRuns.some((run) => run.symptoms),
    NO_INJURY_DETAILS: !goal.injuryNotes && !goal.injuryHistory
  };
  const usedSignalKeys = [...new Set(reply.usedSignalKeys)].filter((key) => available[key]);
  const missingSignalKeys = [...new Set(reply.missingSignalKeys)].filter((key) => missing[key]);
  return coachResponseSchema.parse({
    ...reply,
    progressAssessment: reply.progressAssessment ?? reply.summary,
    positiveSignals: reply.positiveSignals ?? [], recoveryAdvice: reply.recoveryAdvice ?? [],
    nextWorkout: null, upcomingWorkouts: [],
    usedSignalKeys, usedSignals: usedSignalKeys, missingSignalKeys, dataGaps: missingSignalKeys
  });
}
