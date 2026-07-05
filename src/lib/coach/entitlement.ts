import "server-only";

import { getPrisma } from "@/lib/db";
import { CoachError } from "@/lib/coach/errors";

export type CoachTier = "SUBSCRIBED" | "TRIAL" | "NONE";

export type CoachEntitlement = {
  tier: CoachTier;
  dailyLimit: number;
  monthlyLimit: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  plan: string | null;
  usage: { daily: number; monthly: number } | null;
};

export const COACH_TRIAL_DAYS = readPositiveLimit(process.env.COACH_TRIAL_DAYS, 7);

const TIER_LIMITS: Record<Exclude<CoachTier, "NONE">, { daily: number; monthly: number }> = {
  SUBSCRIBED: {
    daily: readPositiveLimit(process.env.COACH_SUBSCRIBED_DAILY_LIMIT, 20),
    monthly: readPositiveLimit(process.env.COACH_SUBSCRIBED_MONTHLY_LIMIT, 400)
  },
  TRIAL: {
    daily: readPositiveLimit(process.env.COACH_TRIAL_DAILY_LIMIT, 3),
    monthly: readPositiveLimit(process.env.COACH_TRIAL_MONTHLY_LIMIT, 30)
  }
};

export const COACH_TIER_LIMITS = TIER_LIMITS;

type ActiveSubscriptionRow = {
  plan: string;
  expiresAt: Date;
};

/**
 * Resolve a runner's current coach access tier and limits.
 *
 * - SUBSCRIBED: an admin-activated subscription is still within its paid window.
 * - TRIAL: still inside the free coach window (COACH_TRIAL_DAYS, default 7) from account signup.
 * - NONE: trial used up and no active subscription -> AI coach is blocked until subscribed.
 */
export async function resolveCoachEntitlement(userId: string): Promise<CoachEntitlement> {
  const prisma = getPrisma();

  const subscriptions = await prisma.$queryRaw<ActiveSubscriptionRow[]>`
    SELECT "plan", "expiresAt"
    FROM "CoachSubscription"
    WHERE "userId" = ${userId} AND "status" = 'ACTIVE' AND "expiresAt" > NOW()
    ORDER BY "expiresAt" DESC
    LIMIT 1
  `;
  const subscription = subscriptions[0];

  const users = await prisma.$queryRaw<Array<{ createdAt: Date }>>`
    SELECT "createdAt" FROM "User" WHERE "id" = ${userId} LIMIT 1
  `;
  const createdAt = users[0]?.createdAt ?? null;
  const trialEndsAt = createdAt ? new Date(createdAt.getTime() + COACH_TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;
  const trialActive = trialEndsAt ? trialEndsAt.getTime() > Date.now() : false;

  if (subscription) {
    return {
      tier: "SUBSCRIBED",
      dailyLimit: TIER_LIMITS.SUBSCRIBED.daily,
      monthlyLimit: TIER_LIMITS.SUBSCRIBED.monthly,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: subscription.expiresAt.toISOString(),
      plan: subscription.plan,
      usage: null
    };
  }

  if (trialActive) {
    return {
      tier: "TRIAL",
      dailyLimit: TIER_LIMITS.TRIAL.daily,
      monthlyLimit: TIER_LIMITS.TRIAL.monthly,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: null,
      plan: null,
      usage: null
    };
  }

  return {
    tier: "NONE",
    dailyLimit: 0,
    monthlyLimit: 0,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    subscriptionEndsAt: null,
    plan: null,
    usage: null
  };
}

/** Resolve entitlement plus current usage, for display in the runner dashboard. */
export async function getCoachEntitlementWithUsage(userId: string): Promise<CoachEntitlement> {
  const entitlement = await resolveCoachEntitlement(userId);
  if (entitlement.tier === "NONE") return entitlement;
  const usage = await countCoachUsage(userId);
  return { ...entitlement, usage };
}

/** Enforce access + tiered rate limits before an AI request. Throws CoachError when blocked. */
export async function enforceCoachEntitlement(userId: string): Promise<CoachEntitlement> {
  const entitlement = await resolveCoachEntitlement(userId);

  if (entitlement.tier === "NONE") {
    throw new CoachError(
      "Your free trial has ended. Subscribe to continue using the AI coach.",
      402,
      "COACH_SUBSCRIPTION_REQUIRED"
    );
  }

  const usage = await countCoachUsage(userId);

  if (usage.daily >= entitlement.dailyLimit) {
    throw new CoachError("Daily AI coach limit reached.", 429, "DAILY_AI_LIMIT_REACHED");
  }
  if (usage.monthly >= entitlement.monthlyLimit) {
    throw new CoachError("Monthly AI coach limit reached.", 429, "MONTHLY_AI_LIMIT_REACHED");
  }

  return { ...entitlement, usage };
}

async function countCoachUsage(userId: string) {
  const rows = await getPrisma().$queryRaw<Array<{ daily: bigint; monthly: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '24 hours') AS daily,
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS monthly
    FROM "CoachInteraction"
    WHERE "userId" = ${userId} AND "status" IN ('PENDING', 'COMPLETED', 'FAILED')
  `;
  return {
    daily: Number(rows[0]?.daily ?? 0),
    monthly: Number(rows[0]?.monthly ?? 0)
  };
}

function readPositiveLimit(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
