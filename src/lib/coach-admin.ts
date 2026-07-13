import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { recordAdminAuditLog, AdminError } from "@/lib/admin";
import { buildPaginationMeta, parsePagination, type PaginatedResult, type PaginationParams } from "@/lib/pagination";
import { COACH_TRIAL_DAYS } from "@/lib/coach/entitlement";
import { getPendingCoachRequestCharge, markCoachRequestReviewed } from "@/lib/coach/subscription";
import { createNotification } from "@/lib/notifications";

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
  failedRequests: number;
  failedRequests30d: number;
};

type SummaryQueryRow = {
  totalRequests: bigint;
  requests30d: bigint;
  inputTokens: bigint | null;
  outputTokens: bigint | null;
  costMicroUsd: bigint | null;
  activeSubscribers: bigint;
  coachedUsers: bigint;
  failedRequests: bigint;
  failedRequests30d: bigint;
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
  // Natural expiry is NOT a cancellation — leave cancelledAt null so "was this cancelled early?"
  // reporting stays accurate.
  await getPrisma().$executeRaw`
    UPDATE "CoachSubscription"
    SET "status" = 'EXPIRED', "updatedAt" = NOW()
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
      (SELECT COUNT(DISTINCT "userId") FROM "CoachInteraction") AS "coachedUsers",
      (SELECT COUNT(*) FROM "AiUsageLog" WHERE "status" = 'FAILED') AS "failedRequests",
      (SELECT COUNT(*) FROM "AiUsageLog" WHERE "status" = 'FAILED' AND "createdAt" >= NOW() - INTERVAL '30 days') AS "failedRequests30d"
  `;
  const row = rows[0];
  return {
    totalRequests: Number(row?.totalRequests ?? 0),
    requests30d: Number(row?.requests30d ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    costMicroUsd: Number(row?.costMicroUsd ?? 0),
    activeSubscribers: Number(row?.activeSubscribers ?? 0),
    coachedUsers: Number(row?.coachedUsers ?? 0),
    failedRequests: Number(row?.failedRequests ?? 0),
    failedRequests30d: Number(row?.failedRequests30d ?? 0)
  };
}

export type CoachErrorRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  kind: "Audio" | "Text";
  model: string;
  errorCode: string | null;
  errorMessage: string | null;
  interactionType: string | null;
  createdAt: Date;
};

type ErrorQueryRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  model: string;
  errorCode: string | null;
  errorMessage: string | null;
  interactionType: string | null;
  createdAt: Date;
};

/** Most recent failed OpenAI calls (audio + text) with details, so admins can diagnose and fix. */
export async function getRecentCoachErrors(limit = 30): Promise<CoachErrorRow[]> {
  const rows = await getPrisma().$queryRaw<ErrorQueryRow[]>`
    SELECT
      log."id",
      log."userId",
      CONCAT(u."firstName", ' ', u."lastName") AS "name",
      u."email",
      log."model",
      log."errorCode",
      log."errorMessage",
      ci."type"::TEXT AS "interactionType",
      log."createdAt"
    FROM "AiUsageLog" log
    LEFT JOIN "User" u ON u."id" = log."userId"
    LEFT JOIN "CoachInteraction" ci ON ci."id" = log."interactionId"
    WHERE log."status" = 'FAILED'
    ORDER BY log."createdAt" DESC
    LIMIT ${limit}
  `;

  // Audio (transcription) calls have no linked interaction; the Whisper model name also marks them.
  return rows.map((row) => ({
    ...row,
    kind: row.interactionType === null ? "Audio" : "Text"
  }));
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
  humanCoaching?: boolean;
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
        "id", "userId", "plan", "status", "months", "amountDa", "note", "humanCoaching",
        "startedAt", "expiresAt", "createdByUserId", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${input.userId}, ${input.plan}::"CoachSubscriptionPlan", 'ACTIVE',
        ${months}, ${input.amountDa ?? null}, ${input.note ?? null}, ${input.humanCoaching ?? false},
        NOW(), NOW() + (${`${months} months`})::interval, ${input.actorId}, NOW()
      )
    `;
  });

  await recordAdminAuditLog({
    actorId: input.actorId,
    action: "coach.subscription_activated",
    targetType: "User",
    targetId: input.userId,
    summary: `Activated ${input.plan} coach subscription for ${months} month(s)${input.humanCoaching ? " (human coaching)" : ""}`,
    metadata: { plan: input.plan, months, amountDa: input.amountDa, humanCoaching: input.humanCoaching ?? false }
  });
}

export type HumanCoachNote = {
  id: string;
  message: string;
  createdAt: Date;
};

// Post a personal note from a real coach to a runner (the "human coaching" tier). Stored as a
// HUMAN_NOTE coach interaction so it lives alongside the AI history, and delivered as an in-app
// notification carrying the full text.
export async function postHumanCoachNote(input: { actorId: string; userId: string; message: string }) {
  const message = input.message.trim();
  if (message.length < 1 || message.length > 2000) {
    throw new AdminError("A coaching note must be between 1 and 2000 characters.");
  }
  const prisma = getPrisma();
  const user = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT "id", "email" FROM "User" WHERE "id" = ${input.userId} LIMIT 1
  `;
  if (!user[0]) throw new AdminError("User not found.");

  await prisma.$executeRaw`
    INSERT INTO "CoachInteraction" (
      "id", "userId", "type", "status", "response", "safety", "authorId", "promptVersion",
      "createdAt", "completedAt"
    ) VALUES (
      ${randomUUID()}, ${input.userId}, 'HUMAN_NOTE'::"CoachInteractionType", 'COMPLETED'::"CoachInteractionStatus",
      ${JSON.stringify({ summary: message })}::jsonb, '{}'::jsonb, ${input.actorId}, 'human-note',
      NOW(), NOW()
    )
  `;

  await createNotification({
    userId: input.userId,
    type: "COACH_NOTE",
    title: "Message from your coach",
    body: message.length > 140 ? `${message.slice(0, 140)}…` : message,
    href: "/account/coach/notes"
  });

  await recordAdminAuditLog({
    actorId: input.actorId,
    action: "coach.human_note_sent",
    targetType: "User",
    targetId: input.userId,
    summary: "Sent a human coaching note"
  });
}

// A runner's human-coach notes, newest first, for the notes screen.
export async function getHumanCoachNotes(userId: string, limit = 50): Promise<HumanCoachNote[]> {
  const rows = await getPrisma().$queryRaw<Array<{ id: string; response: { summary?: string } | null; createdAt: Date }>>`
    SELECT "id", "response", "createdAt"
    FROM "CoachInteraction"
    WHERE "userId" = ${userId} AND "type" = 'HUMAN_NOTE' AND "status" = 'COMPLETED'
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ id: row.id, message: row.response?.summary ?? "", createdAt: row.createdAt }));
}

export type PendingCoachRequestRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  plan: string;
  amountDa: number | null;
  paymentMethod: string | null;
  paymentProofUrl: string;
  createdAt: Date;
};

/** Runner-submitted subscription requests awaiting review, newest first, with the requester. */
export async function getPendingCoachSubscriptionRequests(): Promise<PendingCoachRequestRow[]> {
  return getPrisma().$queryRaw<PendingCoachRequestRow[]>`
    SELECT request."id", request."userId",
           CONCAT(u."firstName", ' ', u."lastName") AS "name", u."email",
           request."plan"::text AS "plan", request."amountDa", request."paymentMethod",
           request."paymentProofUrl", request."createdAt"
    FROM "CoachSubscriptionRequest" request
    INNER JOIN "User" u ON u."id" = request."userId"
    WHERE request."status" = 'PENDING'
    ORDER BY request."createdAt" ASC
  `;
}

// Approve a pending request: mint the real subscription via activateCoachSubscription (reusing its
// cancel-existing + audit-log logic) and mark the request APPROVED. Rejects invalid/stale ids.
export async function approveCoachSubscriptionRequest(input: { actorId: string; requestId: string }) {
  const charge = await getPendingCoachRequestCharge(input.requestId);
  if (!charge) throw new AdminError("Subscription request not found or already reviewed.");

  await activateCoachSubscription({
    actorId: input.actorId,
    userId: charge.userId,
    plan: charge.plan,
    months: charge.months,
    amountDa: charge.amountDa,
    note: "From subscription request"
  });

  await markCoachRequestReviewed({ requestId: input.requestId, status: "APPROVED", reviewerId: input.actorId });
  await notifyRunnerRequestReviewed(charge.userId, "APPROVED", null);
}

export async function rejectCoachSubscriptionRequest(input: { actorId: string; requestId: string; reason?: string | null }) {
  const charge = await getPendingCoachRequestCharge(input.requestId);
  if (!charge) throw new AdminError("Subscription request not found or already reviewed.");

  await markCoachRequestReviewed({
    requestId: input.requestId,
    status: "REJECTED",
    reviewerId: input.actorId,
    reviewNote: input.reason ?? null
  });

  await recordAdminAuditLog({
    actorId: input.actorId,
    action: "coach.subscription_request_rejected",
    targetType: "User",
    targetId: charge.userId,
    summary: "Rejected coach subscription request"
  });
  await notifyRunnerRequestReviewed(charge.userId, "REJECTED", input.reason ?? null);
}

// Tell the runner their payment was approved or declined (localized to their coach language), so
// they don't have to revisit the subscribe page to find out. Best-effort — never blocks the review.
const REVIEW_NOTIFY_COPY = {
  en: {
    approvedTitle: "Your coach subscription is active",
    approvedBody: "Your payment was approved — your AI coach is now active. Enjoy your training!",
    rejectedTitle: "Coach payment needs another look",
    rejectedBody: (note: string | null) =>
      `We couldn't confirm your payment${note ? `: ${note}` : "."} Please submit a new payment on the subscribe page.`
  },
  fr: {
    approvedTitle: "Votre abonnement coach est actif",
    approvedBody: "Votre paiement a été approuvé — votre coach IA est maintenant actif. Bon entraînement !",
    rejectedTitle: "Votre paiement coach doit être revérifié",
    rejectedBody: (note: string | null) =>
      `Nous n'avons pas pu confirmer votre paiement${note ? ` : ${note}` : "."} Veuillez soumettre un nouveau paiement.`
  },
  ar: {
    approvedTitle: "اشتراك مدربك مُفعّل",
    approvedBody: "تمت الموافقة على دفعتك — مدربك الذكي مفعّل الآن. تدريبًا موفقًا!",
    rejectedTitle: "دفعة المدرب تحتاج إلى مراجعة",
    rejectedBody: (note: string | null) =>
      `تعذر تأكيد دفعتك${note ? `: ${note}` : "."} يرجى إرسال دفعة جديدة من صفحة الاشتراك.`
  }
} as const;

async function notifyRunnerRequestReviewed(userId: string, decision: "APPROVED" | "REJECTED", reviewNote: string | null) {
  try {
    const rows = await getPrisma().$queryRaw<Array<{ email: string; preferredLocale: string | null }>>`
      SELECT u."email", g."preferredLocale"
      FROM "User" u
      LEFT JOIN "RunnerGoal" g ON g."userId" = u."id" AND g."status" = 'ACTIVE'
      WHERE u."id" = ${userId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return;
    const locale = row.preferredLocale === "fr" || row.preferredLocale === "ar" ? row.preferredLocale : "en";
    const copy = REVIEW_NOTIFY_COPY[locale];
    const title = decision === "APPROVED" ? copy.approvedTitle : copy.rejectedTitle;
    const body = decision === "APPROVED" ? copy.approvedBody : copy.rejectedBody(reviewNote);
    await createNotification({
      userId,
      type: "COACH_SUBSCRIPTION_REVIEW",
      title,
      body,
      href: "/account/coach",
      channels: ["IN_APP", "EMAIL", "PUSH"],
      email: { to: row.email, subject: title }
    });
  } catch (error) {
    console.error("Coach review notification failed", userId, error);
  }
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
