import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getPrisma } from "@/lib/db";

/**
 * Run-session lifecycle and client diagnostics (crashes, OS process kills, named issues).
 *
 * Both exist for the same reason: on 2026-11-14 a run disappeared on a phone and the server had no
 * trace of it — it was never saved, so nothing reached us, and the only evidence was on the device.
 * A session row is written when a recording starts, so a run that never arrives is visible as a
 * session that never became SAVED; a diagnostic report carries the device facts needed to explain
 * why.
 *
 * Privacy: sessions carry the start position rounded to ~110 m; diagnostics never carry location
 * (keys that look like coordinates, credentials or contact details are dropped here even if a
 * client sends them). Both are visible to admins only. Retention: diagnostics 90 days, sessions
 * 180 days (run-maintenance cron).
 */

const SCALAR = z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()]);

/** Flat device/state facts. Bounded in keys and size so a client cannot use it as storage. */
const deviceFactsSchema = z.record(z.string().max(60), SCALAR).refine((value) => Object.keys(value).length <= 60, "Too many device facts.");

const sportSchema = z.enum(["RUN", "WALK", "TRAIL", "RIDE"]);

export const runSessionStartSchema = z.object({
  clientId: z.string().uuid(),
  startedAt: z.coerce.date(),
  sport: sportSchema.default("RUN"),
  position: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracyM: z.number().min(0).max(100_000).optional(),
      ageSeconds: z.number().min(0).max(86_400 * 30).optional(),
    })
    .nullable()
    .optional(),
  appVersion: z.string().max(40).optional(),
  deviceModel: z.string().max(120).optional(),
  device: deviceFactsSchema.optional(),
});

export const runSessionEndSchema = z.object({
  reason: z.enum(["FINISHED", "DISCARDED", "SIGNED_OUT", "RESTORED_INTERRUPTED"]),
  endedAt: z.coerce.date(),
  summary: deviceFactsSchema.optional(),
});

const KEY_DENYLIST = /^(lat|lng|lon|latitude|longitude|location|coords?|email|phone|token|access_?token|refresh_?token|password|authorization|cookie)$/i;

/** Drops keys that would turn a diagnostic payload into a store of location or credentials. */
export function scrubFacts(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (Array.isArray(value)) return value.slice(0, 60).map((item) => scrubFacts(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      if (KEY_DENYLIST.test(key)) continue;
      out[key] = scrubFacts(inner, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.slice(0, 2000);
  return value;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function recordRunSessionStart(userId: string, input: z.infer<typeof runSessionStartSchema>) {
  const position = input.position ?? null;
  const device = input.device ? (scrubFacts(input.device) as Prisma.InputJsonValue) : undefined;
  const data = {
    sport: input.sport,
    startedAt: input.startedAt,
    startLat: position ? roundCoordinate(position.lat) : null,
    startLng: position ? roundCoordinate(position.lng) : null,
    startAccuracyM: position?.accuracyM ?? null,
    appVersion: input.appVersion ?? null,
    deviceModel: input.deviceModel ?? null,
    ...(device ? { device } : {}),
  };
  // A retried start (offline queue) lands on the same row; it never resurrects an ended session.
  return getPrisma().runSession.upsert({
    where: { userId_clientId: { userId, clientId: input.clientId } },
    create: { userId, clientId: input.clientId, ...data },
    update: data,
    select: { id: true, status: true },
  });
}

export async function recordRunSessionEnd(userId: string, clientId: string, input: z.infer<typeof runSessionEndSchema>) {
  const prisma = getPrisma();
  const existing = await prisma.runSession.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { id: true, status: true },
  });
  const status = input.reason === "DISCARDED" || input.reason === "SIGNED_OUT" ? "DISCARDED" : "FINISHED";
  const summary = input.summary ? (scrubFacts(input.summary) as Prisma.InputJsonValue) : undefined;

  if (!existing) {
    // The start never arrived (sent from an older build, or lost): keep the end anyway.
    return prisma.runSession.create({
      data: { userId, clientId, startedAt: input.endedAt, status, endedAt: input.endedAt, endReason: input.reason, ...(summary ? { summary } : {}) },
      select: { id: true, status: true },
    });
  }
  // SAVED is final: the run exists, a late "finished" event must not demote it.
  return prisma.runSession.update({
    where: { id: existing.id },
    data: {
      ...(existing.status === "SAVED" ? {} : { status }),
      endedAt: input.endedAt,
      endReason: input.reason,
      ...(summary ? { summary } : {}),
    },
    select: { id: true, status: true },
  });
}

/** Called when a run is stored: the session it came from is now SAVED. */
export async function markRunSessionSaved(userId: string, clientId: string | null | undefined, runId: string) {
  if (!clientId) return;
  await getPrisma().runSession.updateMany({
    where: { userId, clientId },
    data: { status: "SAVED", runId },
  });
}

export const diagnosticReportSchema = z.object({
  reportId: z.string().uuid(),
  installId: z.string().uuid().optional(),
  kind: z.enum(["CRASH", "PROCESS_EXIT", "ISSUE"]),
  code: z.string().regex(/^[a-z0-9_.:-]{1,80}$/i),
  message: z.string().max(4000).optional(),
  stackTrace: z.string().max(64_000).optional(),
  occurredAt: z.coerce.date(),
  platform: z.string().max(20).default("android"),
  appVersion: z.string().max(40).optional(),
  buildType: z.string().max(20).optional(),
  deviceManufacturer: z.string().max(80).optional(),
  deviceModel: z.string().max(120).optional(),
  osVersion: z.string().max(40).optional(),
  sdkInt: z.number().int().min(1).max(100).optional(),
  device: deviceFactsSchema.optional(),
  context: z.record(z.string().max(60), z.unknown()).optional(),
  runClientId: z.string().uuid().optional(),
});

export const diagnosticBatchSchema = z.object({
  reports: z.array(diagnosticReportSchema).min(1).max(20),
});

/**
 * Groups one problem across devices and builds: the code, the exception line, and the top app
 * frames with line numbers removed (they move between builds; the method usually does not).
 */
export function diagnosticFingerprint(code: string, stackTrace?: string | null): string {
  const lines = (stackTrace ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  const head = (lines[0] ?? "").replace(/:.*$/, "");
  const frames = lines
    .filter((line) => line.startsWith("at "))
    .slice(0, 4)
    .map((line) => line.replace(/:\d+\)/g, ")"));
  return createHash("sha1").update([code, head, ...frames].join("|")).digest("hex").slice(0, 20);
}

export async function storeDiagnosticReports(userId: string | null, reports: z.infer<typeof diagnosticReportSchema>[]) {
  const prisma = getPrisma();
  let stored = 0;
  for (const report of reports) {
    const context = report.context ? (scrubFacts(report.context) as Prisma.InputJsonValue) : undefined;
    const device = report.device ? (scrubFacts(report.device) as Prisma.InputJsonValue) : undefined;
    try {
      await prisma.clientDiagnosticReport.create({
        data: {
          reportId: report.reportId,
          userId,
          installId: report.installId ?? null,
          kind: report.kind,
          code: report.code,
          message: report.message ?? null,
          stackTrace: report.stackTrace ?? null,
          fingerprint: diagnosticFingerprint(report.code, report.stackTrace),
          occurredAt: report.occurredAt,
          platform: report.platform,
          appVersion: report.appVersion ?? null,
          buildType: report.buildType ?? null,
          deviceManufacturer: report.deviceManufacturer ?? null,
          deviceModel: report.deviceModel ?? null,
          osVersion: report.osVersion ?? null,
          sdkInt: report.sdkInt ?? null,
          runClientId: report.runClientId ?? null,
          ...(device ? { device } : {}),
          ...(context ? { context } : {}),
        },
      });
      stored += 1;
    } catch (error) {
      // A retried upload: the reportId is already stored. Anything else is a real failure.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  return stored;
}

/**
 * Nightly upkeep: sessions that never produced a run become ABANDONED (the "lost run" signal),
 * and old telemetry is deleted per the retention above.
 */
export async function runTelemetryMaintenance(now = new Date()) {
  const prisma = getPrisma();
  const day = 24 * 60 * 60 * 1000;
  const abandonedStarted = await prisma.runSession.updateMany({
    where: { status: "STARTED", runId: null, startedAt: { lt: new Date(now.getTime() - day) } },
    data: { status: "ABANDONED" },
  });
  // Finished but never saved: the outbox retries for days, so wait longer before calling it lost.
  const abandonedFinished = await prisma.runSession.updateMany({
    where: { status: "FINISHED", runId: null, startedAt: { lt: new Date(now.getTime() - 3 * day) } },
    data: { status: "ABANDONED" },
  });
  const purgedReports = await prisma.clientDiagnosticReport.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * day) } } });
  const purgedSessions = await prisma.runSession.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 180 * day) } } });
  return {
    abandoned: abandonedStarted.count + abandonedFinished.count,
    purgedReports: purgedReports.count,
    purgedSessions: purgedSessions.count,
  };
}
