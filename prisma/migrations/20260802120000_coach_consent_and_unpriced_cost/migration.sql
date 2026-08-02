-- Auditable coach consent grants (combined coach review, U-02). Scaffolding ahead of the full
-- SEC-002 health-data policy: persists the onboarding consent checkbox as a versioned, per-purpose
-- grant instead of transient UI state. Enforcement lands with the policy.

CREATE TYPE "CoachConsentPurpose" AS ENUM ('HEALTH_COACHING_AI');

CREATE TYPE "CoachConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN');

CREATE TABLE "CoachConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "CoachConsentPurpose" NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "status" "CoachConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "sourceClient" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoachConsent_userId_purpose_status_idx" ON "CoachConsent"("userId", "purpose", "status");

ALTER TABLE "CoachConsent" ADD CONSTRAINT "CoachConsent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unpriced AI usage must be NULL, not zero (combined coach review, U-18): estimateCostMicroUsd
-- previously returned 0 for any model outside the price table, which read as "free" on the admin
-- cost dashboard. Existing rows keep their values; only the column contract changes.
ALTER TABLE "AiUsageLog" ALTER COLUMN "estimatedCostMicroUsd" DROP NOT NULL,
    ALTER COLUMN "estimatedCostMicroUsd" DROP DEFAULT;
