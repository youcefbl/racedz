import "server-only";

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { getPrisma } from "@/lib/db";
import { CoachError } from "@/lib/coach/errors";
import { resolveCoachEntitlement, type CoachEntitlement } from "@/lib/coach/entitlement";
import { COACH_PLANS, resolvePlanCharge } from "@/lib/coach/plans";
import { notifyAdminsCoachSubscriptionRequest } from "@/lib/notifications";
import { resolveCoachPaymentProofPath } from "@/lib/storage";

// Payment proof must be an image the runner actually uploaded to the coach-payment scope. That
// scope returns an authenticated app-route URL (not a public /uploads path), which this validates —
// preventing arbitrary URLs from being stored.
const PROOF_PATH = /^\/api\/coach\/subscription\/proof\/[0-9]{4}-[0-9]{2}\/[a-f0-9-]+\.(jpg|png|webp|gif)$/;
const REQUESTABLE_PLANS = ["MONTHLY", "THREE_MONTH", "YEARLY"] as const;
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

  // Capture any prior pending proof so its file can be removed when this resubmit replaces it.
  const prior = await prisma.$queryRaw<Array<{ paymentProofUrl: string }>>`
    SELECT "paymentProofUrl" FROM "CoachSubscriptionRequest"
    WHERE "userId" = ${userId} AND "status" = 'PENDING' LIMIT 1
  `;

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

  // Best-effort: delete the replaced proof file (don't accumulate financial screenshots) and ping
  // admins that there's a payment to review. Neither should block or fail the submit.
  const priorUrl = prior[0]?.paymentProofUrl;
  if (priorUrl && priorUrl !== proofUrl) await deleteProofFile(priorUrl);

  const users = await prisma.$queryRaw<Array<{ firstName: string; lastName: string }>>`
    SELECT "firstName", "lastName" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  const runnerName = `${users[0]?.firstName ?? ""} ${users[0]?.lastName ?? ""}`.trim();
  await notifyAdminsCoachSubscriptionRequest({ runnerName }).catch((error) => {
    console.error("Coach payment admin notification failed", error);
  });

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

// Remove a coach-payment proof image from disk (best-effort — a missing file is fine).
async function deleteProofFile(url: string | null | undefined) {
  if (!url) return;
  const filePath = resolveCoachPaymentProofPath(url);
  if (filePath) await unlink(filePath).catch(() => {});
}

// Withdraw the runner's own pending request (they picked the wrong plan/screenshot), deleting the
// proof file. Only affects a PENDING row owned by the caller.
export async function withdrawCoachSubscriptionRequest(userId: string): Promise<{ withdrawn: boolean }> {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw<Array<{ paymentProofUrl: string }>>`
    DELETE FROM "CoachSubscriptionRequest"
    WHERE "userId" = ${userId} AND "status" = 'PENDING'
    RETURNING "paymentProofUrl"
  `;
  if (!rows[0]) return { withdrawn: false };
  await deleteProofFile(rows[0].paymentProofUrl);
  return { withdrawn: true };
}

// Runner cancels their own active coach subscription (billing is manual, so this just stops the
// entitlement). Scoped to the caller's own userId.
export async function cancelOwnCoachSubscription(userId: string): Promise<{ cancelled: boolean }> {
  const result = await getPrisma().$executeRaw`
    UPDATE "CoachSubscription"
    SET "status" = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW()
    WHERE "userId" = ${userId} AND "status" = 'ACTIVE'
  `;
  return { cancelled: result > 0 };
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
