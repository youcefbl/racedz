-- Richer AI coach onboarding profile.
-- Adds running history, volume, recent performance, and health context to RunnerGoal.

ALTER TABLE "RunnerGoal"
  ADD COLUMN "yearsRunning" INTEGER,
  ADD COLUMN "peakWeeklyDistanceKm" DOUBLE PRECISION,
  ADD COLUMN "longestRecentRunKm" DOUBLE PRECISION,
  ADD COLUMN "recentRaceResult" TEXT,
  ADD COLUMN "restingHeartRate" INTEGER,
  ADD COLUMN "injuryHistory" TEXT,
  ADD COLUMN "chronicConditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "healthNotes" TEXT;
