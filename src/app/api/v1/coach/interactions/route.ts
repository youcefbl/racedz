import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getCoachEntitlementWithUsage } from "@/lib/coach/entitlement";
import { createCoachInteraction, getConversationHistory } from "@/lib/coach/service";
import { CoachError } from "@/lib/coach/errors";
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
      // The coach's reply is a structured object server-side; the app shows its text and nothing
      // else, so the shape can evolve without breaking older clients.
      response: typeof row.response === "object" && row.response !== null
        ? (row.response as { summary?: string; message?: string }).summary ??
          (row.response as { message?: string }).message ??
          null
        : (row.response as string | null),
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
 * An interaction may come back PENDING: generation is asynchronous, and the client polls the GET
 * above rather than holding a request open across a phone falling asleep.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-ask", viewer.id), 20, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many messages. Try again shortly."));

  try {
    const result = await createCoachInteraction(viewer.id, await readJsonBody(request));
    return apiOk(request, result, { status: 201 });
  } catch (error) {
    if (error instanceof CoachError) {
      const code = error.status === 404 ? "NOT_FOUND" : error.status === 409 ? "CONFLICT" : error.status === 429 ? "RATE_LIMITED" : "VALIDATION_FAILED";
      throw new ApiError(code, error.message);
    }
    if (error instanceof Error && error.name === "ZodError") {
      throw new ApiError("VALIDATION_FAILED", "Check your message and try again.");
    }
    throw error;
  }
});
