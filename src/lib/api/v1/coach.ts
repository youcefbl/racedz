/**
 * Shared shaping for the coach payloads the mobile facade returns.
 *
 * This lives in one place because the two routes that needed it had drifted: the conversation
 * endpoint flattened a reply to its summary string, while the overview endpoint handed the raw
 * `response` column through as `latestReview.text` — a JSON object where the client's contract said
 * string. Any runner who had ever asked the coach a question got a parse failure and an error screen
 * on the Coach tab, and it only surfaced once a test account actually had an interaction.
 */

type CoachReplyShape = {
  summary?: string;
  message?: string;
  progressAssessment?: string;
  positiveSignals?: string[];
  warningSignals?: string[];
  recoveryAdvice?: string[];
  requiresProfessionalAdvice?: boolean;
  dataGaps?: string[];
  followUpQuestion?: string | null;
};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

/** The reply's headline text, whatever shape the row is stored in. Null when there is none. */
export function coachReplySummary(raw: unknown): string | null {
  if (typeof raw === "string") return raw.length > 0 ? raw : null;
  if (typeof raw !== "object" || raw === null) return null;
  const reply = raw as CoachReplyShape;
  return reply.summary ?? reply.message ?? null;
}

/**
 * The runner-facing parts of a stored coach reply.
 *
 * `warningSignals` and `requiresProfessionalAdvice` are the reply's caution, not decoration on the
 * summary — dropping them showed the phone strictly less than the website said for the same reply.
 *
 * `nextWorkout`/`upcomingWorkouts` are deliberately excluded: the plan endpoints own the schedule and
 * a second copy here could disagree with it. `memoryCandidates` and `usedSignals` are internal — the
 * write layer decides what is remembered, and echoing either tells the client about the prompt.
 */
export function coachReplyDto(raw: unknown) {
  const summary = coachReplySummary(raw);
  if (!summary) return null;
  const reply = (typeof raw === "object" && raw !== null ? raw : {}) as CoachReplyShape;
  return {
    summary,
    progressAssessment: reply.progressAssessment ?? null,
    positiveSignals: asStrings(reply.positiveSignals),
    warningSignals: asStrings(reply.warningSignals),
    recoveryAdvice: asStrings(reply.recoveryAdvice),
    requiresProfessionalAdvice: reply.requiresProfessionalAdvice === true,
    dataGaps: asStrings(reply.dataGaps),
    followUpQuestion: typeof reply.followUpQuestion === "string" ? reply.followUpQuestion : null,
  };
}
