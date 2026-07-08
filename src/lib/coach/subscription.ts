import "server-only";

import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { CoachError } from "@/lib/coach/errors";
import { resolveCoachEntitlement, type CoachEntitlement } from "@/lib/coach/entitlement";
import { COACH_PLANS, resolvePlanCharge } from "@/lib/coach/plans";

// Payment proof must be an image the runner actually uploaded to the coach-payment scope — mirrors
// the race-registration proof check, preventing arbitrary URLs from being stored.
const PROOF_PATH = /^\/uploads\/coach-payment\/[0-9]{4}-[0-9]{2}\/[a-f0-9-]+\.(jpg|png|webp|gif)$/;
const REQUESTABLE_PLANS = ["MONTHLY", "YEARLY"] as const;
type RequestablePlan = (typeof REQUESTABLE_PLANS)[number];

export type CoachSubscriptionRequestRow = {
  id: string;
  plan: string;
  amountDa: number | null;
  paymentMethod: string | null;
  paymentProofUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export type CoachSubscriptionRow = {
  id: string;
  plan: string;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  months: number;
  amountDa: number | null;
  startedAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
};

export type CoachSubscriptionOverview = {
  entitlement: CoachEntitlement;
  pendingRequest: CoachSubscriptionRequestRow | null;
  requests: CoachSubscriptionRequestRow[];
  subscriptions: CoachSubscriptionRow[];
};

function isRequestablePlan(value: unknown): value is RequestablePlan {
  return typeof value === "string" && (REQUESTABLE_PLANS as readonly string[]).includes(value);
}

// Record a runner's subscription request with their payment proof. One pending request per runner:
// resubmitting updates the existing pending row rather than stacking duplicates. The row sits
// PENDING until an admin approves it (which mints the real CoachSubscription) or rejects it.
export async function submitCoachSubscriptionRequest(
  userId: string,
  input: { plan: unknown; paymentMethod?: unknown; paymentProofUrl: unknown }
): Promise<CoachSubscriptionRequestRow> {
  if (!isRequestablePlan(input.plan)) {
    throw new CoachError("Choose a subscription plan.", 400, "INVALID_PLAN");
  }
  const proofUrl = typeof input.paymentProofUrl === "string" ? input.paymentProofUrl : "";
  if (!PROOF_PATH.test(proofUrl)) {
    throw new CoachError("Upload a clear screenshot of your payment.", 400, "INVALID_PROOF");
  }
  const method =
    typeof input.paymentMethod === "string" && input.paymentMethod.trim() ? input.paymentMethod.trim().slice(0, 40) : null;

  // Store the plan's list price so the admin sees the amount the runner was asked to pay.
  const amountDa = COACH_PLANS[input.plan].priceDa;
  const prisma = getPrisma();

  const updated = await prisma.$executeRaw`
    UPDATE "CoachSubscriptionRequest"
    SET "plan" = ${input.plan}::"CoachSubscriptionPlan", "amountDa" = ${amountDa},
        "paymentMethod" = ${method}, "paymentProofUrl" = ${proofUrl}, "updatedAt" = NOW()
    WHERE "userId" = ${userId} AND "status" = 'PENDING'
  `;

  if (updated === 0) {
    await prisma.$executeRaw`
      INSERT INTO "CoachSubscriptionRequest" (
        "id", "userId", "plan", "amountDa", "paymentMethod", "paymentProofUrl", "status", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${userId}, ${input.plan}::"CoachSubscriptionPlan", ${amountDa},
        ${method}, ${proofUrl}, 'PENDING', NOW()
      )
    `;
  }

  const rows = await prisma.$queryRaw<CoachSubscriptionRequestRow[]>`
    SELECT "id", "plan"::text AS "plan", "amountDa", "paymentMethod", "paymentProofUrl",
           "status"::text AS "status", "reviewNote", "reviewedAt", "createdAt"
    FROM "CoachSubscriptionRequest"
    WHERE "userId" = ${userId} AND "status" = 'PENDING'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0];
}

// Everything the subscribe page shows: current access (tier + trial/subscription dates), any
// pending request, recent request history, and the runner's past subscriptions with their windows.
export async function getCoachSubscriptionOverview(userId: string): Promise<CoachSubscriptionOverview> {
  const prisma = getPrisma();
  const [entitlement, requests, subscriptions] = await Promise.all([
    resolveCoachEntitlement(userId),
    prisma.$queryRaw<CoachSubscriptionRequestRow[]>`
      SELECT "id", "plan"::text AS "plan", "amountDa", "paymentMethod", "paymentProofUrl",
             "status"::text AS "status", "reviewNote", "reviewedAt", "createdAt"
      FROM "CoachSubscriptionRequest"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT 10
    `,
    prisma.$queryRaw<CoachSubscriptionRow[]>`
      SELECT "id", "plan"::text AS "plan", "status"::text AS "status", "months", "amountDa",
             "startedAt", "expiresAt", "cancelledAt"
      FROM "CoachSubscription"
      WHERE "userId" = ${userId}
      ORDER BY "startedAt" DESC
      LIMIT 20
    `
  ]);

  return {
    entitlement,
    pendingRequest: requests.find((request) => request.status === "PENDING") ?? null,
    requests,
    subscriptions
  };
}

// Approve a pending request: mint the real subscription (via the shared activation path, passed in
// to avoid a server-only import cycle) and mark the request APPROVED. Reused by the admin action.
export async function markCoachRequestReviewed(input: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  reviewerId: string;
  reviewNote?: string | null;
}) {
  await getPrisma().$executeRaw`
    UPDATE "CoachSubscriptionRequest"
    SET "status" = ${input.status}::"CoachSubscriptionRequestStatus",
        "reviewedByUserId" = ${input.reviewerId}, "reviewedAt" = NOW(),
        "reviewNote" = ${input.reviewNote ?? null}, "updatedAt" = NOW()
    WHERE "id" = ${input.requestId} AND "status" = 'PENDING'
  `;
}

// The plan/amount to activate for a given request id, or null if it isn't pending. Used by the
// admin approval flow, which then calls activateCoachSubscription with these values.
export async function getPendingCoachRequestCharge(requestId: string) {
  const rows = await getPrisma().$queryRaw<Array<{ userId: string; plan: RequestablePlan; amountDa: number | null }>>`
    SELECT "userId", "plan"::text AS "plan", "amountDa"
    FROM "CoachSubscriptionRequest"
    WHERE "id" = ${requestId} AND "status" = 'PENDING'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const charge = resolvePlanCharge(row.plan, { amountOverride: row.amountDa });
  return { userId: row.userId, plan: row.plan, months: charge.months, amountDa: charge.amountDa };
}
