import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { requireOwnedRun, runSelect, runUpdateSchema, toRunDto } from "@/lib/api/v1/runs";
import { computeSplits, elevationSeries, paceSeries } from "@/lib/coach/run-stats";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** One run, with its full route — the only endpoint that returns route points. */
export const GET = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-run-read", viewer.id), 120, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const run = await requireOwnedRun(viewer.id, id);
  if (run.deletedAt) throw new ApiError("NOT_FOUND", "This run was not found.");

  // Splits and the two series come from the same helpers the website's run detail uses, and are
  // covered by test:run-stats. Deriving them on the phone instead duplicated tested code and got it
  // wrong: the first native version charged each kilometre for the segment that overshot its
  // boundary rather than interpolating the crossing, so every split drifted.
  const points = (run.route ?? null) as Parameters<typeof computeSplits>[0];

  return apiOk(request, {
    ...toRunDto(run, run.route ?? null),
    splits: computeSplits(points),
    paceSeries: paceSeries(points),
    elevationSeries: elevationSeries(points),
  });
});

/**
 * Edit a run's runner-supplied fields.
 *
 * `baseRevision` is a precondition, not a hint. If the server has moved past it — the runner edited
 * the same run on another device, or a coach process touched it — the write is refused with the
 * CURRENT record attached, so the client can show the runner both versions instead of guessing
 * which to keep. Never a silent overwrite of newer data.
 *
 * Only fields a runner types are editable. Distance, duration, pace, route, and validity are
 * server-computed measurements: letting a client rewrite them would make every downstream number
 * (records, plan adherence, coach metrics) untrustworthy.
 */
export const PATCH = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-run-update", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many updates. Try again shortly."));

  const parsed = runUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    const fields = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).flatMap(([field, messages]) =>
        messages?.[0] ? [[field, messages[0]]] : []
      )
    );
    throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.", { fields });
  }

  const { baseRevision, ...changes } = parsed.data;
  const current = await requireOwnedRun(viewer.id, id);
  if (current.deletedAt) throw new ApiError("NOT_FOUND", "This run was not found.");

  // Conditional on the revision, so two devices editing at once cannot both win: the update matches
  // zero rows for the loser rather than overwriting the winner.
  const updated = await getPrisma().runnerRun.updateMany({
    where: { id, userId: viewer.id, revision: baseRevision, deletedAt: null },
    data: { ...changes, revision: { increment: 1 } },
  });

  if (updated.count !== 1) {
    const server = await getPrisma().runnerRun.findFirst({ where: { id, userId: viewer.id }, select: runSelect });
    throw new ApiError(
      "CONFLICT",
      "This run changed somewhere else. Review the latest version before saving again.",
      { serverRevision: server?.revision ?? null, run: server ? toRunDto(server) : null }
    );
  }

  const fresh = await getPrisma().runnerRun.findFirst({ where: { id, userId: viewer.id }, select: runSelect });
  return apiOk(request, toRunDto(fresh!));
});

/**
 * Delete a run.
 *
 * Soft: the row is tombstoned so the next delta sync tells every other device the run is gone. A
 * hard delete would simply vanish from the server while remaining on any phone that already held
 * it, and that phone would happily re-upload it.
 *
 * Deleting an already-deleted run succeeds. A client retrying a delete it never saw acknowledged
 * should not be handed an error for reaching the state it asked for.
 */
export const DELETE = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-run-delete", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Try again shortly."));

  const run = await requireOwnedRun(viewer.id, id);

  if (!run.deletedAt) {
    await getPrisma().runnerRun.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        revision: { increment: 1 },
        // A deleted run must stop being visible to anyone else immediately, whatever the sync
        // state of the owner's other devices.
        isPublic: false,
        // The route is the most sensitive thing on the row — where this person actually ran, door
        // to door. A delete destroys it rather than leaving it behind a flag.
        route: Prisma.DbNull,
      },
    });
  }

  const fresh = await getPrisma().runnerRun.findFirst({ where: { id, userId: viewer.id }, select: runSelect });
  return apiOk(request, toRunDto(fresh!));
});
