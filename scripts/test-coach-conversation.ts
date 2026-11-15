import assert from "node:assert/strict";
import { pendingFollowUp, recentCoachReply, selectConversation, type ConversationRow } from "../src/lib/coach/conversation";
import { evaluateTopicality } from "../src/lib/coach/topicality";
import { coachInteractionInputSchema } from "../src/lib/coach/schemas";

const now = new Date("2026-11-14T10:00:00Z");
const row: ConversationRow = {
  id: "turn-1", goalId: "goal-1", runId: null, type: "CHAT", status: "COMPLETED",
  userMessage: "I feel tired", response: {
    summary: "Let's understand when.", followUpQuestion: "When do you feel tired?",
    quickReplies: ["All day", "After poor sleep", "Toute la journée", "طول النهار"]
  }, safety: { level: "CLEAR" }, createdAt: new Date("2026-11-14T09:00:00Z")
};
const options = { goalId: "goal-1", runId: null, now };
assert.deepEqual(selectConversation([row, { ...row, id: "other-goal", goalId: "goal-2" },
  { ...row, id: "other-run", runId: "run-2" }], options), [row]);
assert.deepEqual(selectConversation([row], { ...options, replyToInteractionId: "not-owned" }), []);
assert.deepEqual(selectConversation([row], { ...options, replyToInteractionId: row.id }), [row]);
const postRun = { ...row, id: "post-run", runId: "run-1", type: "POST_RUN" };
assert.deepEqual(selectConversation([postRun], { ...options, scope: "GOAL" }), [postRun],
  "runless chat retains a same-goal post-run clarification");
assert.deepEqual(selectConversation([postRun], { ...options, scope: "GOAL", replyToInteractionId: postRun.id }), [postRun],
  "runless chat may explicitly anchor the same-goal post-run exchange");
assert.deepEqual(selectConversation([postRun], options), [], "exact run scope remains the default");
for (const reply of row.response!.quickReplies!) {
  assert.equal(evaluateTopicality(reply, pendingFollowUp([row], now)).onTopic, true, reply);
}
assert.equal(evaluateTopicality("Write me a poem about the sea", pendingFollowUp([row], now)).onTopic, false);
assert.equal(pendingFollowUp([{ ...row, status: "BLOCKED" }], now), null);
assert.equal(pendingFollowUp([{ ...row, createdAt: new Date("2026-11-12T09:00:00Z") }], now), null);
assert.equal(pendingFollowUp([row, { ...row, response: { summary: "Done", followUpQuestion: null } }], now), null);
for (const repair of ["No, I meant Friday", "Non, je voulais dire vendredi", "ماشي هكا، قصدي الجمعة", "la, qasdi vendredi", "machi hka, qasdi lyoum"]) {
  assert.equal(evaluateTopicality(repair, recentCoachReply([{ ...row, response: { summary: "Done", followUpQuestion: null } }], now)).onTopic, true);
}
for (const bypass of ["no, what is the capital of Japan?", "non, écris-moi un poème sur Paris"]) {
  assert.equal(evaluateTopicality(bypass, pendingFollowUp([row], now)).onTopic, false, bypass);
}
assert.equal(coachInteractionInputSchema.safeParse({ type: "WEEKLY_REVIEW", replyToInteractionId: row.id }).success, false);
assert.equal(coachInteractionInputSchema.safeParse({ type: "CHAT", message: "All day", replyToInteractionId: row.id }).success, true);
console.log("PASS — contextual replies, stale/consumed questions, goal/run isolation and anchor validation");
