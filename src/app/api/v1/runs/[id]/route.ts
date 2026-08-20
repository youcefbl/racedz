import { deleteRun } from "@/lib/coach/service";
import { deriveLaps, type LapBoundary } from "@/lib/coach/laps";
import { bestEffortsForRun, ensureBestEffortsBackfilled } from "@/lib/coach/best-efforts-service";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { requireOwnedRun, runSelect, runUpdateSchema, toRunDto } from "@/lib/api/v1/runs";
import { computeSplits, elevationSeries, paceSeries } from "@/lib/coach/run-stats";
import { findWorkoutMatchForRun } from "@/lib/coach/service";
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
  const splitMeters = new URL(request.url).searchParams.get("unit") === "mi" ? 1609.344 : 1000;

  // A planned workout this run might belong to, recomputed on read.
  //
  // The matcher already runs at save time, but its suggestion was returned once and stored
  // nowhere — so a client that did not act on that single response could never offer it again.
  // Recomputing here is one indexed query over the active plan's ±1-day window, and it is
  // self-correcting: it stops returning a workout as soon as the run is linked or the workout is
  // claimed. Only asked for an unlinked, still-matchable run.
  const workout = await resolveWorkoutContext(viewer.id, run);

  // Best efforts are persisted rows, not a scan (NATRUN-06.3). Runs saved before the table existed
  // are analysed once, in bounded batches, the first times this runner opens any detail.
  await ensureBestEffortsBackfilled(viewer.id);
  const bestEfforts = await bestEffortsForRun(viewer.id, run.id);

  return apiOk(request, {
    ...toRunDto(run, run.route ?? null),
    // Splits per mile for runners who chose miles (NATRUN-06.8); the stored data stays metric.
    splits: computeSplits(points, splitMeters),
    paceSeries: paceSeries(points),
    elevationSeries: elevationSeries(points),
    bestEfforts,
    laps: deriveLaps(run.laps as LapBoundary[] | null, run.distanceKm * 1000, run.durationSeconds),
    ...workout,
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

  // An activity the server classified as non-foot (a bike, a car, a scooter) cannot be published.
  // The website's updateRun() has always refused this, but this route writes through updateMany
  // and so skipped the check — a SUSPECT ride could be made public from the phone while the same
  // action failed on the web. The save path already forces isPublic to false for these; this stops
  // the runner turning it back on afterwards.
  if (changes.isPublic === true && current.validity !== "VALID") {
    throw new ApiError("CONFLICT", "This activity must be reviewed before it can be public.");
  }

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

  await requireOwnedRun(viewer.id, id);

  // One deletion path for web and mobile: tombstone + revision bump + unpublish + route destroyed
  // + workout slot released + performance memory reconciled (see deleteRun).
  await deleteRun(viewer.id, id);

  const fresh = await getPrisma().runnerRun.findFirst({ where: { id, userId: viewer.id }, select: runSelect });
  return apiOk(request, toRunDto(fresh!));
});

/**
 * The run's workout link, and — when it has none — the workout it most likely belongs to.
 *
 * Returns the linked workout's title so the client can name it ("counted toward Tuesday tempo")
 * instead of showing an opaque id, and a `suggestedMatch` the runner can accept or decline.
 * Never both: a linked run has nothing to suggest.
 *
 * Best-effort. A failure here must not take down a run's detail page — the numbers and the route
 * are what the runner opened it for.
 */
async function resolveWorkoutContext(userId: string, run: { workoutId?: unknown; startedAt?: unknown; distanceKm?: unknown; validity?: unknown; sport?: unknown }) {
  try {
    if (run.workoutId) {
      const workout = await getPrisma().trainingWorkout.findFirst({
        where: { id: run.workoutId as string },
        select: { id: true, title: true },
      });
      return { workoutTitle: workout?.title ?? null, suggestedMatch: null };
    }
    // A non-foot activity is excluded from workout completion server-side, so offering to link it
    // would be offering an action the confirm endpoint is going to refuse. A RIDE is refused by
    // the same endpoint whatever its validity (a ride cannot complete a running workout), so it
    // gets no suggestion either (review P2).
    if (run.validity !== "VALID" || run.sport === "RIDE") return { workoutTitle: null, suggestedMatch: null };

    const best = await findWorkoutMatchForRun(userId, run.startedAt as Date, run.distanceKm as number);
    return {
      workoutTitle: null,
      suggestedMatch: best ? { workoutId: best.workoutId, title: best.title, confidence: best.confidence } : null,
    };
  } catch {
    return { workoutTitle: null, suggestedMatch: null };
  }
}
