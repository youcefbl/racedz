import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import {
  MAX_RUN_BODY_BYTES,
  MAX_RUNS_PAGE,
  downsampleRoute,
  parseUpdatedSince,
  runCreateSchema,
  runSelect,
  toRunDto,
} from "@/lib/api/v1/runs";
import { createRunnerRun, linkCoachInteractionsToRun } from "@/lib/coach/service";
import { CoachError } from "@/lib/coach/errors";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Delta sync: everything of the caller's that changed since `updatedSince`, tombstones included.
 *
 * Ordered by `updatedAt` ascending so the client can take the last item's `updatedAt` as its next
 * cursor and never miss a record. Without `updatedSince` this is a plain first page — a device that
 * has just signed in and holds nothing.
 *
 * Routes are deliberately absent: a page can hold 50 runs and the route is by far the largest
 * column, so the client fetches it per run when it needs the map.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-runs-list", viewer.id), 120, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const url = new URL(request.url);
  const updatedSince = parseUpdatedSince(url.searchParams.get("updatedSince"));
  const requested = Number(url.searchParams.get("limit") ?? MAX_RUNS_PAGE);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), MAX_RUNS_PAGE) : MAX_RUNS_PAGE;
  // Optional sport filter (NATRUN-07.1); anything else is ignored rather than refused.
  const sportParam = url.searchParams.get("sport");
  const sport = sportParam && ["RUN", "WALK", "TRAIL", "RIDE"].includes(sportParam) ? (sportParam as "RUN" | "WALK" | "TRAIL" | "RIDE") : undefined;

  const runs = await getPrisma().runnerRun.findMany({
    where: {
      userId: viewer.id,
      ...(updatedSince ? { updatedAt: { gt: updatedSince } } : { deletedAt: null }),
      ...(sport ? { sport } : {}),
    },
    // The full route is read only so it can be thinned to a preview below; it never leaves in full.
    select: { ...runSelect, route: true },
    orderBy: { updatedAt: "asc" },
    take: limit + 1,
  });

  const hasMore = runs.length > limit;
  const page = hasMore ? runs.slice(0, limit) : runs;
  const cursor = page.at(-1)?.updatedAt ?? updatedSince;

  return apiOk(request, page.map((run) => toRunDto(run, undefined, downsampleRoute(run.route))), {
    meta: {
      limit,
      hasMore,
      // The client stores this and sends it back next time. Server-issued, never device-derived.
      nextCursor: cursor ? cursor.toISOString() : null,
    },
  });
});

/**
 * Record a run.
 *
 * Reuses createRunnerRun() — the same helper the website posts to — so workout matching, the
 * non-foot validity classification, server-side elevation resolution, weather capture, and pace
 * derivation are identical on both clients rather than reimplemented for mobile.
 *
 * `clientId` makes the write safe to retry: a phone that recorded a run offline, posted it, and
 * lost the response can post the exact same body again and get the original run back instead of a
 * duplicate. That is enforced by the (userId, clientId) unique index, not by a check-then-insert.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-runs-create", viewer.id), 30, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many runs saved. Try again shortly."));

  // A run body is dominated by its route, and the default 64 KB cap is far below what a real one
  // needs: the recorder emits up to 1500 points, which is ~80 KB on its own, so every normally
  // recorded run would have been refused as "body too large" before its route was ever inspected.
  // Sized to comfortably hold MAX_SYNC_ROUTE_POINTS so the point cap is the limit that actually
  // applies, and a client that exceeds it gets a field error naming the route rather than an
  // opaque 400.
  const parsed = runCreateSchema.safeParse(await readJsonBody(request, MAX_RUN_BODY_BYTES));
  if (!parsed.success) {
    const fields = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).flatMap(([field, messages]) =>
        messages?.[0] ? [[field, messages[0]]] : []
      )
    );
    // Field names only — a route is the runner's movements and their notes are personal.
    console.warn("[api/v1][runs] rejected fields:", Object.keys(fields).join(", "));
    throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.", { fields });
  }

  const prisma = getPrisma();
  const { clientId, ...input } = parsed.data;

  // Retry of a run already stored: hand back the original rather than recording it twice.
  const existing = await prisma.runnerRun.findUnique({
    where: { userId_clientId: { userId: viewer.id, clientId } },
    select: runSelect,
  });
  if (existing) {
    // A retry of an already-stored run still carries its in-run Coach chats: the first attempt may
    // have created the run but lost its response before (or without) linking them. Idempotent — the
    // helper only touches this user's still-unlinked interactions, so re-linking is a safe no-op.
    if (input.coachInteractionIds && input.coachInteractionIds.length > 0) {
      await linkCoachInteractionsToRun(viewer.id, existing.id, input.coachInteractionIds);
    }
    return apiOk(request, toRunDto(existing), { status: 200, headers: { "Idempotent-Replay": "true" } });
  }

  let created;
  try {
    created = await createRunnerRun(viewer.id, { ...input, source: input.source ?? "GPS" });
  } catch (error) {
    if (error instanceof CoachError) {
      const code = error.status === 404 ? "NOT_FOUND" : error.status === 409 ? "CONFLICT" : "VALIDATION_FAILED";
      throw new ApiError(code, error.message);
    }
    throw error;
  }

  // createRunnerRun() predates the sync contract and does not know about clientId, so the run is
  // stamped immediately afterwards. A concurrent duplicate loses the unique index here rather than
  // creating a second run — the same reserve-by-constraint approach registration uses.
  try {
    await prisma.runnerRun.update({ where: { id: created.run.id }, data: { clientId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await prisma.runnerRun.delete({ where: { id: created.run.id } });
      const winner = await prisma.runnerRun.findUnique({
        where: { userId_clientId: { userId: viewer.id, clientId } },
        select: runSelect,
      });
      if (winner) {
        // Deleting our losing run released (SET NULL) any interactions createRunnerRun linked to it,
        // so re-point them at the run that won the clientId. Still only this user's unlinked rows.
        if (input.coachInteractionIds && input.coachInteractionIds.length > 0) {
          await linkCoachInteractionsToRun(viewer.id, winner.id, input.coachInteractionIds);
        }
        return apiOk(request, toRunDto(winner), { status: 200, headers: { "Idempotent-Replay": "true" } });
      }
    }
    throw error;
  }

  const stored = await prisma.runnerRun.findUnique({ where: { id: created.run.id }, select: runSelect });
  return apiOk(request, toRunDto(stored!), { status: 201 });
});
