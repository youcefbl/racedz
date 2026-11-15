import type { CoachResponse } from "@/lib/coach/schemas";

export type ConversationRow = {
  id: string;
  goalId: string | null;
  runId: string | null;
  type: string;
  status: string;
  userMessage: string | null;
  response: Partial<CoachResponse> | null;
  safety: { level?: string } | null;
  createdAt: Date;
};

export const FOLLOW_UP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Rows must already be owner-scoped by the repository. POST_RUN stays run-scoped; the unified
 * runless CHAT thread may use prior exchanges from the same goal so a short answer can follow a
 * post-run clarification shown immediately above it in the app. */
export function selectConversation(
  rows: ConversationRow[],
  options: {
    goalId: string;
    runId: string | null;
    scope?: "EXACT_RUN" | "GOAL";
    replyToInteractionId?: string | null;
    now: Date;
  }
): ConversationRow[] {
  const eligible = rows.filter((row) => row.goalId === options.goalId &&
    (options.scope === "GOAL" || row.runId === options.runId) &&
    ["COMPLETED", "BLOCKED"].includes(row.status) && row.response && row.createdAt <= options.now);
  const anchor = options.replyToInteractionId
    ? eligible.find((row) => row.id === options.replyToInteractionId)
    : undefined;
  if (options.replyToInteractionId && !anchor) return [];
  return eligible.filter((row) => !anchor || row.createdAt <= anchor.createdAt)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).slice(-6);
}

export function recentCoachReply(rows: ConversationRow[], now: Date): Partial<CoachResponse> | null {
  const latest = rows.at(-1);
  if (!latest || latest.status !== "COMPLETED") return null;
  const age = now.getTime() - latest.createdAt.getTime();
  return age >= 0 && age <= FOLLOW_UP_MAX_AGE_MS ? latest.response : null;
}

export function pendingFollowUp(rows: ConversationRow[], now: Date): Partial<CoachResponse> | null {
  const reply = recentCoachReply(rows, now);
  return reply?.followUpQuestion ? reply : null;
}
