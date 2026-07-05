import { Prisma, type ReportCategory, type ReportStatus } from "@prisma/client";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { buildPaginationMeta, parsePagination, type PaginatedResult, type PaginationParams } from "@/lib/pagination";

// User-submitted moderation reports. Submit path mirrors the coach POST route
// (auth + rate-limit + zod + typed error); admin queue mirrors the audit-log reader.

export const REPORT_CATEGORIES = ["SCAM", "SPAM", "OFFENSIVE", "INCORRECT_INFO", "OTHER"] as const;
export const REPORTABLE_TARGET_TYPES = ["RaceEvent", "RunnerRun", "User"] as const;

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  SCAM: "Scam / fake",
  SPAM: "Spam",
  OFFENSIVE: "Offensive",
  INCORRECT_INFO: "Incorrect info",
  OTHER: "Other"
};

export const reportInputSchema = z.object({
  targetType: z.enum(REPORTABLE_TARGET_TYPES),
  targetId: z.string().min(1).max(64),
  category: z.enum(REPORT_CATEGORIES),
  details: z.string().trim().max(1000).optional()
});

export type ReportInput = z.infer<typeof reportInputSchema>;

export class ReportError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "REPORT_ERROR") {
    super(message);
    this.name = "ReportError";
    this.status = status;
    this.code = code;
  }
}

/** Create a report; deduplicates one OPEN report per reporter+target and checks the target exists. */
export async function createReport({ reporterId, input }: { reporterId: string; input: ReportInput }) {
  const prisma = getPrisma();

  const exists = await targetExists(input.targetType, input.targetId);
  if (!exists) {
    throw new ReportError("That content no longer exists.", 404, "TARGET_NOT_FOUND");
  }

  const duplicate = await prisma.report.findFirst({
    where: { reporterId, targetType: input.targetType, targetId: input.targetId, status: "OPEN" },
    select: { id: true }
  });
  if (duplicate) {
    throw new ReportError("You've already reported this — our team is reviewing it.", 409, "DUPLICATE");
  }

  return prisma.report.create({
    data: {
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      category: input.category,
      details: input.details || null
    }
  });
}

async function targetExists(targetType: string, targetId: string): Promise<boolean> {
  const prisma = getPrisma();
  if (targetType === "RaceEvent") return Boolean(await prisma.raceEvent.findUnique({ where: { id: targetId }, select: { id: true } }));
  if (targetType === "RunnerRun") return Boolean(await prisma.runnerRun.findUnique({ where: { id: targetId }, select: { id: true } }));
  if (targetType === "User") return Boolean(await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }));
  return false;
}

export type AdminReportRow = {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  details: string | null;
  targetType: string;
  targetId: string;
  targetLabel: string;
  targetAdminHref: string | null;
  reporterName: string;
  reporterEmail: string;
  resolutionNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export async function getAdminReports(
  filters: { status?: string; category?: string; targetType?: string } = {},
  pagination?: PaginationParams
): Promise<PaginatedResult<AdminReportRow>> {
  const prisma = getPrisma();
  const { page, limit, skip } = pagination ?? parsePagination();

  const where: Prisma.ReportWhereInput = {
    status: isReportStatus(filters.status) ? filters.status : undefined,
    category: isReportCategory(filters.category) ? filters.category : undefined,
    targetType: filters.targetType && (REPORTABLE_TARGET_TYPES as readonly string[]).includes(filters.targetType) ? filters.targetType : undefined
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip, take: limit }),
    prisma.report.count({ where })
  ]);

  // Batch-resolve reporter users and targets so the queue avoids N+1 lookups.
  const userIds = new Set<string>();
  reports.forEach((r) => userIds.add(r.reporterId));
  const raceIds = reports.filter((r) => r.targetType === "RaceEvent").map((r) => r.targetId);
  const runIds = reports.filter((r) => r.targetType === "RunnerRun").map((r) => r.targetId);
  const targetUserIds = reports.filter((r) => r.targetType === "User").map((r) => r.targetId);
  targetUserIds.forEach((id) => userIds.add(id));

  const [users, races, runs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, firstName: true, lastName: true, email: true } }),
    raceIds.length ? prisma.raceEvent.findMany({ where: { id: { in: raceIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    runIds.length ? prisma.runnerRun.findMany({ where: { id: { in: runIds } }, select: { id: true, title: true } }) : Promise.resolve([])
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const raceById = new Map(races.map((r) => [r.id, r]));
  const runById = new Map(runs.map((r) => [r.id, r]));

  const items: AdminReportRow[] = reports.map((report) => {
    const reporter = userById.get(report.reporterId);
    let targetLabel = report.targetId;
    let targetAdminHref: string | null = null;
    if (report.targetType === "RaceEvent") {
      targetLabel = raceById.get(report.targetId)?.title ?? "(deleted race)";
      targetAdminHref = `/admin/races/${report.targetId}`;
    } else if (report.targetType === "User") {
      const u = userById.get(report.targetId);
      targetLabel = u ? `${u.firstName} ${u.lastName}` : "(deleted user)";
      targetAdminHref = `/admin/users/${report.targetId}`;
    } else if (report.targetType === "RunnerRun") {
      targetLabel = runById.get(report.targetId)?.title ?? "Run";
    }

    return {
      id: report.id,
      category: report.category,
      status: report.status,
      details: report.details,
      targetType: report.targetType,
      targetId: report.targetId,
      targetLabel,
      targetAdminHref,
      reporterName: reporter ? `${reporter.firstName} ${reporter.lastName}` : "Unknown",
      reporterEmail: reporter?.email ?? "",
      resolutionNote: report.resolutionNote,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt
    };
  });

  return { items, ...buildPaginationMeta(total, page, limit) };
}

export async function getReportStatusCounts(): Promise<Record<ReportStatus, number>> {
  const rows = await getPrisma().report.groupBy({ by: ["status"], _count: { _all: true } });
  const counts: Record<ReportStatus, number> = { OPEN: 0, ACTIONED: 0, DISMISSED: 0 };
  rows.forEach((row) => {
    counts[row.status] = row._count._all;
  });
  return counts;
}

/** Mark a report resolved (ACTIONED or DISMISSED). Returns the updated row. */
export async function resolveReport({
  reportId,
  adminId,
  status,
  note
}: {
  reportId: string;
  adminId: string;
  status: Extract<ReportStatus, "ACTIONED" | "DISMISSED">;
  note?: string | null;
}) {
  return getPrisma().report.update({
    where: { id: reportId },
    data: { status, resolvedById: adminId, resolutionNote: note ?? null, resolvedAt: new Date() }
  });
}

function isReportStatus(value?: string): value is ReportStatus {
  return value === "OPEN" || value === "ACTIONED" || value === "DISMISSED";
}

function isReportCategory(value?: string): value is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(value ?? "");
}
