import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { ApiError } from "@/lib/api/v1/http";

// Shared pieces of the mobile runs sync contract (docs/NATIVE_ANDROID_OPTION_PLAN.md §3).
//
// The device is the source of truth for a run only until it reaches the server; after that the
// server is, and the client reconciles. Three fields carry that:
//
//   clientId  — the run's identity while it is still only on the phone, and the idempotency key.
//   revision  — what an edit was based on. If the server has moved on, the edit is refused.
//   deletedAt — a tombstone, so a delete propagates instead of the run reappearing from a device
//               that still held a copy.

/**
 * Hard cap on route points accepted from a client.
 *
 * The recorder already downsamples to 1500 (src/lib/native/run-engine.ts), so this is roughly 3x
 * headroom, not a limit a correct client will meet. A run that exceeds it is REJECTED rather than
 * truncated: silently dropping part of someone's route would leave them with a wrong distance and
 * no indication why.
 */
export const MAX_SYNC_ROUTE_POINTS = 5000;

/**
 * Body cap for a run upload.
 *
 * Must stay comfortably above [MAX_SYNC_ROUTE_POINTS] worth of points (~60 bytes each with
 * elevation and timestamp) or the generic body limit fires first and the point cap becomes
 * unreachable — which is exactly what happened on the first draft: the shared 64 KB default would
 * have rejected every normally recorded run, since 1500 points is already ~80 KB.
 */
export const MAX_RUN_BODY_BYTES = 512 * 1024;

/** Delta pages are bounded because each run can carry a full route. */
export const MAX_RUNS_PAGE = 50;

const routePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  elevation: z.number().optional().nullable(),
  timestamp: z.number().int().optional().nullable(),
});

export const runCreateSchema = z.object({
  /** Required for mobile: it is what makes a retry safe. */
  clientId: z.string().uuid(),
  startedAt: z.string().datetime(),
  distanceKm: z.number().positive().max(1000),
  durationSeconds: z.number().int().positive().max(24 * 60 * 60 * 7),
  movingTimeSeconds: z.number().int().positive().max(24 * 60 * 60 * 7).optional(),
  elevationGainM: z.number().int().min(0).max(30000).optional(),
  averageHeartRate: z.number().int().min(20).max(260).optional(),
  avgCadence: z.number().int().min(0).max(300).optional(),
  calories: z.number().int().min(0).max(50000).optional(),
  route: z
    .array(routePointSchema)
    .max(MAX_SYNC_ROUTE_POINTS, `A route may not exceed ${MAX_SYNC_ROUTE_POINTS} points.`)
    .optional(),
  perceivedEffort: z.number().int().min(1).max(10),
  fatigueLevel: z.number().int().min(0).max(10).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  title: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  isPublic: z.boolean().optional(),
  goalId: z.string().optional(),
  workoutId: z.string().optional(),
  source: z.enum(["GPS", "MANUAL", "IMPORTED"]).optional(),
});

export const runUpdateSchema = z.object({
  /** The revision this edit was based on. Refused if the server has since moved past it. */
  baseRevision: z.number().int().positive(),
  title: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  perceivedEffort: z.number().int().min(1).max(10).optional(),
  fatigueLevel: z.number().int().min(0).max(10).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
});

/** Columns a mobile client is allowed to see. Never the owner's identity beyond their own id. */
export const runSelect = {
  id: true,
  clientId: true,
  revision: true,
  deletedAt: true,
  startedAt: true,
  distanceKm: true,
  durationSeconds: true,
  movingTimeSeconds: true,
  averagePaceSecondsPerKm: true,
  elevationGainM: true,
  averageHeartRate: true,
  avgCadence: true,
  calories: true,
  perceivedEffort: true,
  fatigueLevel: true,
  painLevel: true,
  title: true,
  notes: true,
  isPublic: true,
  source: true,
  validity: true,
  validityReason: true,
  goalId: true,
  workoutId: true,
  weather: true,
  createdAt: true,
  updatedAt: true,
} as const;

type RunRow = {
  [K in keyof typeof runSelect]: unknown;
};

/**
 * A run as the mobile client sees it.
 *
 * [route] is supplied only by the single-run endpoint. A delta page can carry 50 runs, and a route
 * is by far the largest thing on the row, so including it in lists turned an equivalent web
 * response into megabytes (see the note on ROUTE_PREVIEW_POINTS in coach/service.ts). A tombstoned
 * run is returned as an id and a deletion marker and nothing else — the client only needs to know
 * to drop it, and a deleted run's GPS should stop being handed out.
 */
export function toRunDto(run: RunRow, route?: unknown) {
  if (run.deletedAt) {
    return {
      id: run.id as string,
      clientId: (run.clientId as string | null) ?? null,
      revision: run.revision as number,
      deleted: true,
      updatedAt: (run.updatedAt as Date).toISOString(),
    };
  }

  return {
    id: run.id as string,
    clientId: (run.clientId as string | null) ?? null,
    revision: run.revision as number,
    deleted: false,
    startedAt: (run.startedAt as Date).toISOString(),
    distanceKm: run.distanceKm as number,
    durationSeconds: run.durationSeconds as number,
    movingTimeSeconds: (run.movingTimeSeconds as number | null) ?? null,
    averagePaceSecondsPerKm: run.averagePaceSecondsPerKm as number,
    elevationGainM: (run.elevationGainM as number | null) ?? null,
    averageHeartRate: (run.averageHeartRate as number | null) ?? null,
    avgCadence: (run.avgCadence as number | null) ?? null,
    calories: (run.calories as number | null) ?? null,
    perceivedEffort: run.perceivedEffort as number,
    fatigueLevel: run.fatigueLevel as number,
    painLevel: run.painLevel as number,
    title: (run.title as string | null) ?? null,
    notes: (run.notes as string | null) ?? null,
    isPublic: run.isPublic as boolean,
    source: run.source as string,
    validity: run.validity as string,
    validityReason: (run.validityReason as string | null) ?? null,
    goalId: (run.goalId as string | null) ?? null,
    workoutId: (run.workoutId as string | null) ?? null,
    weather: (run.weather as unknown) ?? null,
    createdAt: (run.createdAt as Date).toISOString(),
    updatedAt: (run.updatedAt as Date).toISOString(),
    ...(route === undefined ? {} : { route }),
  };
}

/**
 * Parses the `updatedSince` delta cursor.
 *
 * The cursor is always a value the server previously issued (the `updatedAt` of the last run in a
 * page), never the device's own clock — a phone whose clock runs fast would otherwise ask for
 * changes "since the future" and silently skip everything in between.
 */
export function parseUpdatedSince(raw: string | null): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError("VALIDATION_FAILED", "updatedSince must be an ISO-8601 timestamp.");
  }
  return parsed;
}

/** The caller's run, or a typed 404. Never reveals that an id exists but belongs to someone else. */
export async function requireOwnedRun(userId: string, runId: string) {
  const run = await getPrisma().runnerRun.findFirst({
    where: { id: runId, userId },
    select: { ...runSelect, route: true },
  });
  if (!run) throw new ApiError("NOT_FOUND", "This run was not found.");
  return run;
}
