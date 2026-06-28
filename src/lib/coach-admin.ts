import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { recordAdminAuditLog, AdminError } from "@/lib/admin";
import { buildPaginationMeta, parsePagination, type PaginatedResult, type PaginationParams } from "@/lib/pagination";
import { COACH_TRIAL_DAYS } from "@/lib/coach/entitlement";

export type CoachTierLabel = "SUBSCRIBED" | "TRIAL" | "EXPIRED";

export type CoachUsageRow = {
  userId: string;
  name: string;
  email: string;
  tier: CoachTierLabel;
  totalRequests: number;
  requests30d: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  lastActivityAt: Date | null;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: Date | null;
};

export type CoachUsageSummary = {
  totalRequests: number;
  requests30d: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  activeSubscribers: number;
  coachedUsers: number;
};

type SummaryQueryRow = {
  totalRequests: bigint;
  requests30d: bigint;
  inputTokens: bigint | null;
  outputTokens: bigint | null;
  costMicroUsd: bigint | null;
  activeSubscribers: bigint;
  coachedUsers: bigint;
};

type UsageQueryRow = {
  userId: string;
  name: string;
  email: string;
  userCreatedAt: Date;
  totalRequests: bigint;
  requests30d: bigint;
  inputTokens: bigint | null;
  outputTokens: bigint | null;
  costMicroUsd: bigint | null;
  lastActivityAt: Date | null;
  subPlan: string | null;
  subExpiresAt: Date | null;
};

/** Flip ACTIVE subscriptions whose window has passed to EXPIRED so admin views stay accurate. */
export async function expireStaleCoachSubscriptions() {
  await getPrisma().$executeRaw`
    UPDATE "CoachSubscription"
    SET "status" = 'EXPIRED', "cancelledAt" = COALESCE("cancelledAt", NOW()), "updatedAt" = NOW()
    WHERE "status" = 'ACTIVE' AND "expiresAt" <= NOW()
  `;
}

export async function getCoachUsageSummary(): Promise<CoachUsageSummary> {
  const rows = await getPrisma().$queryRaw<SummaryQueryRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "CoachInteraction") AS "totalRequests",
      (SELECT COUNT(*) FROM "CoachInteraction" WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS "requests30d",
      (SELECT COALESCE(SUM("inputTokens"), 0) FROM "AiUsageLog") AS "inputTokens",
      (SELECT COALESCE(SUM("outputTokens"), 0) FROM "AiUsageLog") AS "outputTokens",
      (SELECT COALESCE(SUM("estimatedCostMicroUsd"), 0) FROM "AiUsageLog") AS "costMicroUsd",
      (SELECT COUNT(*) FROM "CoachSubscription" WHERE "status" = 'ACTIVE' AND "expiresAt" > NOW()) AS "activeSubscribers",
      (SELECT COUNT(DISTINCT "userId") FROM "CoachInteraction") AS "coachedUsers"
  `;
  const row = rows[0];
  return {
    totalRequests: Number(row?.totalRequests ?? 0),
    requests30d: Number(row?.requests30d ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    costMicroUsd: Number(row?.costMicroUsd ?? 0),
    activeSubscribers: Number(row?.activeSubscribers ?? 0),
    coachedUsers: Number(row?.coachedUsers ?? 0)
  };
}

export async function getCoachUserUsage(
  filters: { search?: string } = {},
  pagination?: PaginationParams
): Promise<PaginatedResult<CoachUsageRow>> {
  const { page, limit, skip } = pagination ?? parsePagination();
  const prisma = getPrisma();
  const search = filters.search?.trim() ?? "";
  const searchLike = `%${search}%`;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<UsageQueryRow[]>`
      SELECT
        u."id" AS "userId",
        CONCAT(u."firstName", ' ', u."lastName") AS "name",
        u."email",
        u."createdAt" AS "userCreatedAt",
        COALESCE(ci."totalRequests", 0) AS "totalRequests",
        COALESCE(ci."requests30d", 0) AS "requests30d",
        ci."lastActivityAt",
        usage."inputTokens",
        usage."outputTokens",
        usage."costMicroUsd",
        sub."plan" AS "subPlan",
        sub."expiresAt" AS "subExpiresAt"
      FROM "User" u
      LEFT JOIN (
        SELECT "userId",
          COUNT(*) AS "totalRequests",
          COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS "requests30d",
          MAX("createdAt") AS "lastActivityAt"
        FROM "CoachInteraction" GROUP BY "userId"
      ) ci ON ci."userId" = u."id"
      LEFT JOIN (
        SELECT "userId",
          SUM("inputTokens") AS "inputTokens",
          SUM("outputTokens") AS "outputTokens",
          SUM("estimatedCostMicroUsd") AS "costMicroUsd"
        FROM "AiUsageLog" GROUP BY "userId"
      ) usage ON usage."userId" = u."id"
      LEFT JOIN LATERAL (
        SELECT "plan", "expiresAt" FROM "CoachSubscription"
        WHERE "userId" = u."id" AND "status" = 'ACTIVE' AND "expiresAt" > NOW()
        ORDER BY "expiresAt" DESC LIMIT 1
      ) sub ON true
      WHERE (${search} <> '' OR ci."userId" IS NOT NULL OR sub."plan" IS NOT NULL)
        AND (${search} = '' OR u."email" ILIKE ${searchLike} OR CONCAT(u."firstName", ' ', u."lastName") ILIKE ${searchLike})
      ORDER BY ci."lastActivityAt" DESC NULLS LAST, u."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM "User" u
      LEFT JOIN (SELECT DISTINCT "userId" FROM "CoachInteraction") ci ON ci."userId" = u."id"
      LEFT JOIN LATERAL (
        SELECT 1 AS x FROM "CoachSubscription"
        WHERE "userId" = u."id" AND "status" = 'ACTIVE' AND "expiresAt" > NOW() LIMIT 1
      ) sub ON true
      WHERE (${search} <> '' OR ci."userId" IS NOT NULL OR sub."x" IS NOT NULL)
        AND (${search} = '' OR u."email" ILIKE ${searchLike} OR CONCAT(u."firstName", ' ', u."lastName") ILIKE ${searchLike})
    `
  ]);

  const trialMs = COACH_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const items: CoachUsageRow[] = rows.map((row) => {
    let tier: CoachTierLabel = "EXPIRED";
    if (row.subPlan) {
      tier = "SUBSCRIBED";
    } else if (row.userCreatedAt.getTime() + trialMs > now) {
      tier = "TRIAL";
    }

    return {
      userId: row.userId,
      name: row.name,
      email: row.email,
      tier,
      totalRequests: Number(row.totalRequests ?? 0),
      requests30d: Number(row.requests30d ?? 0),
      inputTokens: Number(row.inputTokens ?? 0),
      outputTokens: Number(row.outputTokens ?? 0),
      costMicroUsd: Number(row.costMicroUsd ?? 0),
      lastActivityAt: row.lastActivityAt,
      subscriptionPlan: row.subPlan,
      subscriptionExpiresAt: row.subExpiresAt
    };
  });

  const total = Number(countResult[0]?.count ?? 0);
  return { items, ...buildPaginationMeta(total, page, limit) };
}

export async function activateCoachSubscription(input: {
  actorId: string;
  userId: string;
  plan: "MONTHLY" | "YEARLY" | "CUSTOM";
  months: number;
  amountDa: number | null;
  note: string | null;
}) {
  const months = Math.trunc(input.months);
  if (!Number.isFinite(months) || months < 1 || months > 36) {
    throw new AdminError("Subscription duration must be between 1 and 36 months.");
  }

  const prisma = getPrisma();
  const user = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE "id" = ${input.userId} LIMIT 1
  `;
  if (!user[0]) throw new AdminError("User not found.");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "CoachSubscription"
      SET "status" = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW()
      WHERE "userId" = ${input.userId} AND "status" = 'ACTIVE'
    `;
    await tx.$executeRaw`
      INSERT INTO "CoachSubscription" (
        "id", "userId", "plan", "status", "months", "amountDa", "note",
        "startedAt", "expiresAt", "createdByUserId", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${input.userId}, ${input.plan}::"CoachSubscriptionPlan", 'ACTIVE',
        ${months}, ${input.amountDa ?? null}, ${input.note ?? null},
        NOW(), NOW() + (${`${months} months`})::interval, ${input.actorId}, NOW()
      )
    `;
  });

  await recordAdminAuditLog({
    actorId: input.actorId,
    action: "coach.subscription_activated",
    targetType: "User",
    targetId: input.userId,
    summary: `Activated ${input.plan} coach subscription for ${months} month(s)`,
    metadata: { plan: input.plan, months, amountDa: input.amountDa }
  });
}

export async function deactivateCoachSubscription(input: { actorId: string; userId: string }) {
  const result = await getPrisma().$executeRaw`
    UPDATE "CoachSubscription"
    SET "status" = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW()
    WHERE "userId" = ${input.userId} AND "status" = 'ACTIVE'
  `;

  if (result === 0) throw new AdminError("No active subscription to cancel for this user.");

  await recordAdminAuditLog({
    actorId: input.actorId,
    action: "coach.subscription_deactivated",
    targetType: "User",
    targetId: input.userId,
    summary: "Cancelled active coach subscription"
  });
}
