import { apiError, apiOk, ApiError, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { confirmMemory, deleteAllMemory, dismissMemory, exportMemory, listMemoryForDisplay } from "@/lib/coach/memory-store";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Native parity for the coach-memory privacy surface (COACHPAR-002 / combined review Tier 1).
// Reuses the same memory-store handlers as /api/coach/memory so both clients see identical facts
// and identical delete semantics. Deliberately NOT entitlement-gated: inspecting, correcting, and
// erasing what the coach remembers is a privacy control, not a paid feature — an expired-trial
// runner must still be able to see and delete their data.

/**
 * The runner's active memory, shaped for display. `?export=1` returns the full raw export
 * (every row incl. superseded/dismissed, with provenance) for the runner's data-access right.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-memory", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const url = new URL(request.url);
  if (url.searchParams.get("export")) {
    const rows = await exportMemory(viewer.id);
    return apiOk(request, {
      exportedAt: new Date().toISOString(),
      memories: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        key: row.key,
        value: row.value,
        source: row.source,
        confidence: row.confidence,
        status: row.status,
        goalId: row.goalId,
        confirmedAt: row.confirmedAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  }

  const items = await listMemoryForDisplay(viewer.id);
  return apiOk(request, { items });
});

/** Confirm a fact is still true (resets its staleness clock) or dismiss it (never re-learned). */
export const PATCH = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-coach-memory-edit", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const body = (await readJsonBody(request)) as { action?: unknown; id?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  const id = typeof body.id === "string" ? body.id.slice(0, 64) : "";
  if (!id || (action !== "confirm" && action !== "dismiss")) {
    throw new ApiError("VALIDATION_FAILED", "Provide a memory id and an action of confirm or dismiss.");
  }

  // Both handlers scope by userId in the WHERE clause, so a guessed id belonging to another
  // runner reads as not-found rather than acting cross-user.
  const result = action === "confirm" ? await confirmMemory(viewer.id, id) : await dismissMemory(viewer.id, id);
  const changed = "confirmed" in result ? result.confirmed : result.dismissed;
  if (!changed) throw new ApiError("NOT_FOUND", "That memory was not found.");
  return apiOk(request, { id, action });
});

/** The runner's right to erase: delete every stored memory fact. */
export const DELETE = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  // Low ceiling, matching the web route: this is a destructive control, not a hot path.
  const limited = enforceRateLimit(rateLimitKey("v1-coach-memory-delete", viewer.id), 5, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const { deleted } = await deleteAllMemory(viewer.id);
  return apiOk(request, { deleted });
});
