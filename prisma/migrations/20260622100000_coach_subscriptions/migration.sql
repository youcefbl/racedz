-- AI coach subscriptions (manual admin activation).

CREATE TYPE "CoachSubscriptionPlan" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "CoachSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

CREATE TABLE "CoachSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" "CoachSubscriptionPlan" NOT NULL,
  "status" "CoachSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "months" INTEGER NOT NULL,
  "amountDa" INTEGER,
  "note" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoachSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoachSubscription_userId_status_idx" ON "CoachSubscription"("userId", "status");
CREATE INDEX "CoachSubscription_status_expiresAt_idx" ON "CoachSubscription"("status", "expiresAt");

ALTER TABLE "CoachSubscription"
  ADD CONSTRAINT "CoachSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
