import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getCoachEntitlementWithUsage } from "@/lib/coach/entitlement";
import { createCoachInteraction, getConversationHistory } from "@/lib/coach/service";
import { CoachError } from "@/lib/coach/errors";
import { coachReplyDto, coachErrorToApiError } from "@/lib/api/v1/coach";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * The conversation, newest first, with the caller's remaining quota.
 *
 * Quota travels with the transcript on purpose: the composer has to know before the runner types
 * whether there is an answer left today. Discovering the limit only after sending would waste the
 * message they just wrote.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-chat", viewer.id), 90, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const entitlement = await getCoachEntitlementWithUsage(viewer.id);
  if (entitlement.tier === "NONE") {
    return apiOk(request, { entitlement, messages: [] });
  }

  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const history = await getConversationHistory(viewer.id, { before });

  return apiOk(request, {
    entitlement,
    // Cursor is the createdAt of the last row the client already has; an offset would drift as new
    // interactions land at the top.
    nextCursor: history.nextCursor,
    messages: history.items.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      runId: row.runId,
      userMessage: row.userMessage,
      response: coachReplyDto(row.response),
      // Kept as its own field rather than folded into the reply text: the website renders safety
      // notices deliberately, and flattening one into chat prose would strip a guardrail.
      safety: row.safety ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

/**
 * Ask the coach something.
 *
 * Reuses createCoachInteraction(), which owns the entitlement check, the safety evaluation, and the
 * memory-governance rules. This route adds no AI behaviour of its own — it could not, without
 * putting model output outside the governance the plan requires it stay inside.
 *
 * Generation is synchronous — createCoachInteraction() awaits the provider and this request stays
 * open for the whole reply (measured at ~12 s locally). The client must therefore size its read
 * timeout for a real generation, not for an ordinary API call: timing out client-side does not
 * cancel the work, so the runner would be charged a credit for an answer they never see.
 *
 * The finished reply is returned here in the same shape the GET uses, so the composer can show the
 * answer immediately instead of refetching the whole transcript to find it.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-ask", viewer.id), 20, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many messages. Try again shortly."));

  try {
    const result = await createCoachInteraction(viewer.id, await readJsonBody(request));
    // `plan` is dropped on purpose: when the coach also produced a plan the client refetches
    // /coach/plan, which is the one place the schedule is defined.
    return apiOk(
      request,
      { id: result.id, status: result.status, response: coachReplyDto(result.response), safety: result.safety ?? null },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CoachError) {
      throw coachErrorToApiError(error);
    }
    if (error instanceof Error && error.name === "ZodError") {
      throw new ApiError("VALIDATION_FAILED", "Check your message and try again.");
    }
    throw error;
  }
});
