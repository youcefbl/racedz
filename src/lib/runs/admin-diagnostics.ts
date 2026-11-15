import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { DISTANCE_ALGO_VERSION, getDistanceCalibrationReport } from "@/lib/runs/distance-correction";

/**
 * Read models for /admin/run-diagnostics: run sessions, grouped diagnostic reports, and distance
 * corrections. Admin-only (the page calls requireAdmin). Every query is bounded — this is a triage
 * view over recent data, not an export.
 */

export const DIAGNOSTIC_PERIODS = [7, 30, 90] as const;
export type DiagnosticPeriod = (typeof DIAGNOSTIC_PERIODS)[number];

export function parsePeriod(value: string | undefined): DiagnosticPeriod {
  const days = Number(value);
  return (DIAGNOSTIC_PERIODS as readonly number[]).includes(days) ? (days as DiagnosticPeriod) : 7;
}

const DAY = 24 * 60 * 60 * 1000;
const SESSION_LIMIT = 60;
const REPORT_SCAN_LIMIT = 1000;
const GROUP_LIMIT = 40;

export type DiagnosticFilters = { q?: string; days: DiagnosticPeriod; kind?: string };

type Facts = Record<string, unknown>;

function asFacts(value: Prisma.JsonValue | null): Facts {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Facts) : {};
}

function userWhere(q: string): Prisma.UserWhereInput {
  return {
    OR: [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function getRunDiagnosticsStats(days: DiagnosticPeriod) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - days * DAY);
  const [sessionsByStatus, lost, reports, applied, flagged] = await Promise.all([
    prisma.runSession.groupBy({ by: ["status"], where: { startedAt: { gte: since } }, _count: { _all: true } }),
    prisma.runSession.count({ where: { status: "ABANDONED", startedAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
    prisma.clientDiagnosticReport.findMany({
      where: { createdAt: { gte: since }, kind: { in: ["CRASH", "PROCESS_EXIT"] } },
      select: { fingerprint: true, deviceModel: true, installId: true },
      take: REPORT_SCAN_LIMIT,
    }),
    prisma.runDistanceEvaluation.count({ where: { algoVersion: DISTANCE_ALGO_VERSION, decision: "APPLIED" } }),
    prisma.runDistanceEvaluation.count({ where: { algoVersion: DISTANCE_ALGO_VERSION, decision: "FLAGGED" } }),
  ]);
  const byStatus = Object.fromEntries(sessionsByStatus.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const recordings = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  return {
    recordings,
    saved: byStatus.SAVED ?? 0,
    discarded: byStatus.DISCARDED ?? 0,
    open: (byStatus.STARTED ?? 0) + (byStatus.FINISHED ?? 0),
    lost30d: lost,
    crashes: reports.length,
    crashProblems: new Set(reports.map((r) => r.fingerprint)).size,
    crashDevices: new Set(reports.map((r) => r.installId ?? r.deviceModel ?? "?")).size,
    applied,
    flagged,
    algoVersion: DISTANCE_ALGO_VERSION,
  };
}

export type AdminRunSessionRow = {
  id: string;
  status: string;
  sport: string;
  startedAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  runId: string | null;
  clientId: string;
  userName: string;
  userEmail: string;
  deviceModel: string | null;
  appVersion: string | null;
  osVersion: string | null;
  summary: Facts;
  device: Facts;
  reportCount: number;
  correctedKm: number | null;
};

/** Lost and still-open sessions first (they are the ones to investigate), then newest. */
const STATUS_RANK: Record<string, number> = { ABANDONED: 0, STARTED: 1, FINISHED: 2, DISCARDED: 3, SAVED: 4 };

export async function getAdminRunSessions(filters: DiagnosticFilters): Promise<AdminRunSessionRow[]> {
  const prisma = getPrisma();
  const q = filters.q?.trim();
  const where: Prisma.RunSessionWhereInput = {
    startedAt: { gte: new Date(Date.now() - filters.days * DAY) },
    ...(q
      ? {
          OR: [
            { user: userWhere(q) },
            { deviceModel: { contains: q, mode: "insensitive" } },
            { clientId: { startsWith: q } },
            { runId: { startsWith: q } },
          ],
        }
      : {}),
  };
  const sessions = await prisma.runSession.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: SESSION_LIMIT,
    select: {
      id: true, status: true, sport: true, startedAt: true, endedAt: true, endReason: true, runId: true, clientId: true,
      deviceModel: true, appVersion: true, summary: true, device: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  const clientIds = sessions.map((s) => s.clientId);
  const runIds = sessions.flatMap((s) => (s.runId ? [s.runId] : []));
  const [reportCounts, corrected] = await Promise.all([
    clientIds.length
      ? prisma.clientDiagnosticReport.groupBy({ by: ["runClientId"], where: { runClientId: { in: clientIds } }, _count: { _all: true } })
      : Promise.resolve([]),
    runIds.length
      ? prisma.runnerRun.findMany({ where: { id: { in: runIds }, distanceCorrectedAt: { not: null } }, select: { id: true, distanceKm: true } })
      : Promise.resolve([]),
  ]);
  const reportsByClient = new Map(reportCounts.map((row) => [row.runClientId, row._count._all]));
  const correctedByRun = new Map(corrected.map((run) => [run.id, run.distanceKm]));

  return sessions
    .map((s) => {
      const device = asFacts(s.device);
      return {
        id: s.id,
        status: s.status,
        sport: s.sport,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        endReason: s.endReason,
        runId: s.runId,
        clientId: s.clientId,
        userName: `${s.user.firstName} ${s.user.lastName}`.trim(),
        userEmail: s.user.email,
        deviceModel: s.deviceModel,
        appVersion: s.appVersion,
        osVersion: typeof device.osVersion === "string" ? device.osVersion : null,
        summary: asFacts(s.summary),
        device,
        reportCount: reportsByClient.get(s.clientId) ?? 0,
        correctedKm: s.runId ? correctedByRun.get(s.runId) ?? null : null,
      };
    })
    .sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || b.startedAt.getTime() - a.startedAt.getTime());
}

export type AdminDiagnosticGroup = {
  fingerprint: string;
  kind: string;
  code: string;
  count: number;
  runners: number;
  devices: string[];
  appVersions: string[];
  firstAt: Date;
  lastAt: Date;
  duringRun: number;
  latest: {
    id: string;
    message: string | null;
    stackTrace: string | null;
    userName: string | null;
    userEmail: string | null;
    osVersion: string | null;
    sdkInt: number | null;
    runClientId: string | null;
    device: Facts;
    context: Facts;
  };
};

/** Reports in the window, grouped by fingerprint; newest problem first. */
export async function getAdminDiagnosticGroups(filters: DiagnosticFilters): Promise<AdminDiagnosticGroup[]> {
  const prisma = getPrisma();
  const q = filters.q?.trim();
  const kind = filters.kind === "CRASH" || filters.kind === "PROCESS_EXIT" || filters.kind === "ISSUE" ? filters.kind : undefined;
  const rows = await prisma.clientDiagnosticReport.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - filters.days * DAY) },
      ...(kind ? { kind } : {}),
      ...(q
        ? {
            OR: [
              { user: userWhere(q) },
              { deviceModel: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { runClientId: { startsWith: q } },
            ],
          }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: REPORT_SCAN_LIMIT,
    select: {
      id: true, kind: true, code: true, message: true, stackTrace: true, fingerprint: true, occurredAt: true, userId: true, installId: true,
      deviceManufacturer: true, deviceModel: true, osVersion: true, sdkInt: true, appVersion: true, runClientId: true, device: true, context: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  const groups = new Map<string, AdminDiagnosticGroup & { runnerKeys: Set<string>; deviceSet: Set<string>; versionSet: Set<string> }>();
  for (const row of rows) {
    const device = [row.deviceManufacturer, row.deviceModel].filter(Boolean).join(" ") || "Unknown device";
    const existing = groups.get(row.fingerprint);
    if (!existing) {
      groups.set(row.fingerprint, {
        fingerprint: row.fingerprint,
        kind: row.kind,
        code: row.code,
        count: 0,
        runners: 0,
        devices: [],
        appVersions: [],
        firstAt: row.occurredAt,
        lastAt: row.occurredAt,
        duringRun: 0,
        runnerKeys: new Set(),
        deviceSet: new Set(),
        versionSet: new Set(),
        latest: {
          id: row.id,
          message: row.message,
          stackTrace: row.stackTrace,
          userName: row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : null,
          userEmail: row.user?.email ?? null,
          osVersion: row.osVersion,
          sdkInt: row.sdkInt,
          runClientId: row.runClientId,
          device: asFacts(row.device),
          context: asFacts(row.context),
        },
      });
    }
    const group = groups.get(row.fingerprint)!;
    group.count += 1;
    group.firstAt = row.occurredAt < group.firstAt ? row.occurredAt : group.firstAt;
    group.runnerKeys.add(row.userId ?? row.installId ?? row.id);
    group.deviceSet.add(device);
    if (row.appVersion) group.versionSet.add(row.appVersion);
    if (row.runClientId) group.duringRun += 1;
  }

  return [...groups.values()].slice(0, GROUP_LIMIT).map(({ runnerKeys, deviceSet, versionSet, ...group }) => ({
    ...group,
    runners: runnerKeys.size,
    devices: [...deviceSet],
    appVersions: [...versionSet].sort(),
  }));
}

export type AdminDistanceRow = {
  runId: string;
  decision: string;
  reason: string;
  deviceKm: number;
  routeKm: number;
  confidence: number;
  sport: string;
  startedAt: Date;
  userName: string;
};

export async function getAdminDistanceCorrections() {
  const prisma = getPrisma();
  const [calibration, evaluations] = await Promise.all([
    getDistanceCalibrationReport(),
    prisma.runDistanceEvaluation.findMany({
      where: { algoVersion: DISTANCE_ALGO_VERSION, decision: { in: ["APPLIED", "FLAGGED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        runId: true, decision: true, reason: true, deviceKm: true, routeKm: true, confidence: true, sport: true,
        run: { select: { startedAt: true, user: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);
  const rows: AdminDistanceRow[] = evaluations
    .map((e) => ({
      runId: e.runId,
      decision: e.decision,
      reason: e.reason,
      deviceKm: e.deviceKm,
      routeKm: e.routeKm,
      confidence: e.confidence,
      sport: e.sport,
      startedAt: e.run.startedAt,
      userName: `${e.run.user.firstName} ${e.run.user.lastName}`.trim(),
    }))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return { calibration, rows, algoVersion: DISTANCE_ALGO_VERSION };
}
