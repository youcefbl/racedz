import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { buildPaginationMeta, parsePagination, type PaginatedResult, type PaginationParams } from "@/lib/pagination";

// Admin-facing reader for client-side crash reports (see src/lib/client-error-report.ts /
// POST /api/client-errors). Mirrors the reports.ts admin-queue pattern: paginated list +
// counts, with reporter attribution batch-resolved to avoid N+1 lookups.

export type AdminClientErrorRow = {
  id: string;
  createdAt: Date;
  route: string;
  boundary: string | null;
  message: string;
  stack: string | null;
  digest: string | null;
  platform: string | null;
  userAgent: string | null;
  userName: string | null;
  userEmail: string | null;
  context: Record<string, unknown> | null;
};

export async function getAdminClientErrors(
  filters: { q?: string; boundary?: string; platform?: string } = {},
  pagination?: PaginationParams
): Promise<PaginatedResult<AdminClientErrorRow>> {
  const prisma = getPrisma();
  const { page, limit, skip } = pagination ?? parsePagination();

  const where: Prisma.ClientErrorLogWhereInput = {
    platform: filters.platform === "web" || filters.platform === "android" ? filters.platform : undefined,
    // "__route__" stands in for boundary IS NULL (a route-level crash, not a scoped one).
    boundary: filters.boundary === "__route__" ? null : filters.boundary || undefined,
    ...(filters.q
      ? {
          OR: [
            { message: { contains: filters.q, mode: "insensitive" as const } },
            { route: { contains: filters.q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [rows, total] = await Promise.all([
    prisma.clientErrorLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.clientErrorLog.count({ where })
  ]);

  const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true, email: true } })
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));

  const items: AdminClientErrorRow[] = rows.map((row) => {
    const user = row.userId ? userById.get(row.userId) : undefined;
    return {
      id: row.id,
      createdAt: row.createdAt,
      route: row.route,
      boundary: row.boundary,
      message: row.message,
      stack: row.stack,
      digest: row.digest,
      platform: row.platform,
      userAgent: row.userAgent,
      userName: user ? `${user.firstName} ${user.lastName}` : null,
      userEmail: user?.email ?? null,
      context: (row.context as Record<string, unknown> | null) ?? null
    };
  });

  return { items, ...buildPaginationMeta(total, page, limit) };
}

export async function getClientErrorStats(): Promise<{ total: number; last24h: number; routeCount: number }> {
  const prisma = getPrisma();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total, last24h, routes] = await Promise.all([
    prisma.clientErrorLog.count(),
    prisma.clientErrorLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.clientErrorLog.findMany({ distinct: ["route"], select: { route: true } })
  ]);
  return { total, last24h, routeCount: routes.length };
}

// Distinct boundary names seen so far, for the filter dropdown. Null (route-level crash)
// is represented by the caller as a separate fixed "__route__" option.
export async function getClientErrorBoundaryOptions(): Promise<string[]> {
  const rows = await getPrisma().clientErrorLog.findMany({
    where: { boundary: { not: null } },
    distinct: ["boundary"],
    select: { boundary: true },
    orderBy: { boundary: "asc" }
  });
  return rows.map((row) => row.boundary).filter((value): value is string => Boolean(value));
}

export async function deleteClientError(id: string): Promise<void> {
  await getPrisma().clientErrorLog.delete({ where: { id } }).catch(() => {});
}

export async function clearAllClientErrors(): Promise<void> {
  await getPrisma().clientErrorLog.deleteMany({});
}

export const CLIENT_ERROR_RETENTION_DAYS = 30;

/** Delete crash reports older than the retention window. Used by scripts/prune-client-errors.ts. */
export async function pruneClientErrors(retentionDays: number = CLIENT_ERROR_RETENTION_DAYS) {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const result = await getPrisma().clientErrorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { deleted: result.count, cutoff, retentionDays };
}
