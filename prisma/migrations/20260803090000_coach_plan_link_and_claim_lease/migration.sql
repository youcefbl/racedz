-- 19A-R02: durable plan ↔ interaction link — which coach reply produced this week.
ALTER TABLE "TrainingPlan" ADD COLUMN "sourceInteractionId" TEXT;

-- 19A-R03: processing lease for idempotent interactions. A PENDING row with an old lease belongs
-- to a dead worker; retries may reclaim its requestId instead of getting "in progress" forever.
ALTER TABLE "CoachInteraction" ADD COLUMN "claimedAt" TIMESTAMP(3);
