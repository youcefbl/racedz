import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import {
  MAX_RUN_BODY_BYTES,
  MAX_RUNS_PAGE,
  downsampleRoute,
  parseSyncCursor, encodeSyncCursor,
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
  const since = parseSyncCursor(url.searchParams.get("updatedSince"));
  const requested = Number(url.searchParams.get("limit") ?? MAX_RUNS_PAGE);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), MAX_RUNS_PAGE) : MAX_RUNS_PAGE;
  // Optional sport filter (NATRUN-07.1); anything else is ignored rather than refused.
  const sportParam = url.searchParams.get("sport");
  const sport = sportParam && ["RUN", "WALK", "TRAIL", "RIDE"].includes(sportParam) ? (sportParam as "RUN" | "WALK" | "TRAIL" | "RIDE") : undefined;

  const runs = await getPrisma().runnerRun.findMany({
    where: {
      userId: viewer.id,
      // Compound keyset: strictly newer, or same instant with a greater id (see parseSyncCursor).
      ...(since
        ? since.id
          ? { OR: [{ updatedAt: { gt: since.updatedAt } }, { updatedAt: since.updatedAt, id: { gt: since.id } }] }
          : { updatedAt: { gt: since.updatedAt } }
        : { deletedAt: null }),
      ...(sport ? { sport } : {}),
    },
    // The full route is read only so it can be thinned to a preview below; it never leaves in full.
    select: { ...runSelect, route: true },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  });

  const hasMore = runs.length > limit;
  const page = hasMore ? runs.slice(0, limit) : runs;
  const last = page.at(-1);
  const cursor = last ? { updatedAt: last.updatedAt, id: last.id } : since;

  return apiOk(request, page.map((run) => toRunDto(run, undefined, downsampleRoute(run.route))), {
    meta: {
      limit,
      hasMore,
      // The client stores this and sends it back next time. Server-issued, never device-derived.
      nextCursor: encodeSyncCursor(cursor),
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

  // Replays a concurrent winner: the (userId, clientId) index refused our INSERT before any side
  // effect (workout link, milestones, best efforts) ran, so the other request's run is the run.
  const replayWinner = async () => {
    const winner = await prisma.runnerRun.findUnique({
      where: { userId_clientId: { userId: viewer.id, clientId } },
      select: runSelect,
    });
    if (!winner) return null;
    if (input.coachInteractionIds && input.coachInteractionIds.length > 0) {
      await linkCoachInteractionsToRun(viewer.id, winner.id, input.coachInteractionIds);
    }
    return apiOk(request, toRunDto(winner), { status: 200, headers: { "Idempotent-Replay": "true" } });
  };

  let created;
  try {
    // clientId travels INTO the INSERT (createRunnerRunSchema.clientId), so idempotency is enforced
    // by the unique index at insert time — atomically — rather than by a stamp after the fact.
    created = await createRunnerRun(viewer.id, { ...input, clientId, source: input.source ?? "GPS" });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const replay = await replayWinner();
      if (replay) return replay;
      // Not a clientId replay, so the collision is the OTHER unique index on the row: two runs
      // racing for the same workout slot (RunnerRun.workoutId is unique). The pre-insert
      // "already completed" check can miss a concurrent claim; the index is the referee, and the
      // loser gets the same 409 the check would have given, not a 500 (review P2).
      throw new ApiError("CONFLICT", "This workout already has a completed run.");
    }
    if (error instanceof CoachError) {
      const code = error.status === 404 ? "NOT_FOUND" : error.status === 409 ? "CONFLICT" : "VALIDATION_FAILED";
      throw new ApiError(code, error.message);
    }
    // createRunnerRun() re-parses with the web schema, whose bounds are stricter in places (e.g. a
    // 60 s minimum duration). A body the v1 schema accepted but that one refuses is the client's
    // problem to show, not a 500 — and a background retry must see it as final, not transient.
    if (error instanceof ZodError) {
      const fields = Object.fromEntries(
        Object.entries(error.flatten().fieldErrors).flatMap(([field, messages]) => (messages?.[0] ? [[field, messages[0]]] : []))
      );
      throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.", { fields });
    }
    throw error;
  }

  const stored = await prisma.runnerRun.findUnique({ where: { id: created.run.id }, select: runSelect });
  return apiOk(request, toRunDto(stored!), { status: 201 });
});

/** A raw INSERT that lost the (userId, clientId) unique index: Prisma wraps it as P2010 (raw) with
 * Postgres 23505, or as P2002 for the client API. Either way it is "already stored", not a failure. */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2002") return true;
  if (error.code === "P2010") {
    const meta = error.meta as { code?: string; message?: string } | undefined;
    return meta?.code === "23505" || (meta?.message ?? "").includes("23505") || (meta?.message ?? "").includes("userId_clientId");
  }
  return false;
}
