import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { assembleCoachContext } from "../src/lib/coach/context";
import { assembleProviderReply, coachChatProviderSchema, coachReviewProviderSchema } from "../src/lib/coach/provider-contract";
import { coachResponseSchema } from "../src/lib/coach/schemas";
import { enforceCoachSafety } from "../src/lib/coach/safety";
import { coachContextFixture, COACH_EVAL_NOW } from "./fixtures/coach-context";

const fixture = coachContextFixture();
const { context } = assembleCoachContext(fixture, COACH_EVAL_NOW);
const compact = coachChatProviderSchema.parse({
  responseMode: "ANSWER", summary: "Start gently and build consistency.", nextAction: "Keep the first session easy.",
  quickReplies: [], warningSignals: [], requiresProfessionalAdvice: false,
  usedSignalKeys: ["GOAL", "SLEEP", "WEATHER", "ACTIVE_PLAN"],
  missingSignalKeys: ["NO_RECENT_RUNS", "NO_SLEEP_LOGGED"], followUpQuestion: null, memoryCandidates: []
});
const reply = assembleProviderReply(compact, context);
assert.equal(coachResponseSchema.safeParse(reply).success, true);
assert.deepEqual(reply.usedSignalKeys, ["GOAL"]);
assert.deepEqual(reply.usedSignals, ["GOAL"]);
assert.deepEqual(reply.upcomingWorkouts, []);
assert.equal(reply.progressAssessment, reply.summary);
assert.deepEqual(enforceCoachSafety(reply, fixture.safety, fixture.skeleton, "ar").usedSignals, ["الهدف تاعك"]);
const schema = zodTextFormat(coachChatProviderSchema, "chat").schema as { properties: Record<string, unknown> };
for (const removed of ["usedSignals", "dataGaps", "nextWorkout", "upcomingWorkouts", "progressAssessment", "positiveSignals", "recoveryAdvice"]) {
  assert.equal(removed in schema.properties, false, removed);
}
assert.equal(coachReviewProviderSchema.safeParse(compact).success, false, "reviews require their additional assessment");
const sleepContext = assembleCoachContext(coachContextFixture({ sleep: [{ night: "2026-11-14", durationMinutes: 420 }] }), COACH_EVAL_NOW).context;
assert.deepEqual(assembleProviderReply(compact, sleepContext).missingSignalKeys, ["NO_RECENT_RUNS"]);
const schedule = assembleCoachContext(coachContextFixture({ interaction: { type: "CHAT", message: "Reschedule Friday" } }), COACH_EVAL_NOW).context;
assert.equal(assembleProviderReply(compact, schedule).missingSignalKeys.includes("NO_SLEEP_LOGGED"), false, "not selected does not mean not logged");
console.log("PASS — smaller provider schemas, unchanged public DTO and grounded/localized provenance");
