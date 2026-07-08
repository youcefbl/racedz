-- Runner-submitted coach subscription requests with payment proof, pending admin review.
CREATE TYPE "CoachSubscriptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "CoachSubscriptionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "CoachSubscriptionPlan" NOT NULL,
    "amountDa" INTEGER,
    "paymentMethod" TEXT,
    "paymentProofUrl" TEXT NOT NULL,
    "note" TEXT,
    "status" "CoachSubscriptionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachSubscriptionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoachSubscriptionRequest_userId_status_idx" ON "CoachSubscriptionRequest"("userId", "status");
CREATE INDEX "CoachSubscriptionRequest_status_createdAt_idx" ON "CoachSubscriptionRequest"("status", "createdAt");

ALTER TABLE "CoachSubscriptionRequest" ADD CONSTRAINT "CoachSubscriptionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
