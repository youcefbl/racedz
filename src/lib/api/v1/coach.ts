import { ApiError } from "@/lib/api/v1/http";
import type { CoachError } from "@/lib/coach/errors";

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
  usedSignals?: string[];
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
 * a second copy here could disagree with it. `memoryCandidates` stays internal — the write layer
 * decides what is remembered. `usedSignals` is carried (B83-R09): it is the reviewed transparency
 * feature ("Based on") the web already renders, and native must not show strictly less.
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
    usedSignals: asStrings(reply.usedSignals),
    dataGaps: asStrings(reply.dataGaps),
    followUpQuestion: typeof reply.followUpQuestion === "string" ? reply.followUpQuestion : null,
  };
}

/**
 * Maps a CoachError onto the mobile facade's typed error taxonomy.
 *
 * Every v1 coach route used to inline the same ternary over `error.status`, and that ternary knew
 * only 404/409/429 — so a 403 consent refusal and a 402 subscription refusal both reached the phone
 * as `VALIDATION_FAILED` (422). The native client then showed a re-consent gate as though the
 * runner had mistyped a field, with nothing to route on (review FDE-R01, found by tightening the
 * governance assertion from "403 or 422" to the exact contract).
 *
 * Codes, not statuses, are the contract the client branches on — hence the explicit CONSENT_REQUIRED
 * case ahead of the generic 403.
 */
export function coachErrorToApiError(error: CoachError): ApiError {
  if (error.code === "CONSENT_REQUIRED") return new ApiError("CONSENT_REQUIRED", error.message);

  switch (error.status) {
    case 400:
      return new ApiError("BAD_REQUEST", error.message);
    case 401:
      return new ApiError("UNAUTHENTICATED", error.message);
    case 402:
      return new ApiError("SUBSCRIPTION_REQUIRED", error.message);
    case 403:
      return new ApiError("FORBIDDEN", error.message);
    case 404:
      return new ApiError("NOT_FOUND", error.message);
    case 409:
      return new ApiError("CONFLICT", error.message);
    case 413:
    case 415:
      return new ApiError("BAD_REQUEST", error.message);
    case 429:
      return new ApiError("RATE_LIMITED", error.message);
    case 502:
    case 503:
      return new ApiError("UNAVAILABLE", error.message);
    default:
      return new ApiError("VALIDATION_FAILED", error.message);
  }
}
