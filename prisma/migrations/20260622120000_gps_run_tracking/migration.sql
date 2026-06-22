-- GPS run tracking: moving time, calories, route polyline, GPS source, and body weight for calories.

ALTER TYPE "RunnerRunSource" ADD VALUE IF NOT EXISTS 'GPS';

ALTER TABLE "RunnerRun"
  ADD COLUMN "movingTimeSeconds" INTEGER,
  ADD COLUMN "calories" INTEGER,
  ADD COLUMN "route" JSONB;

ALTER TABLE "RunnerGoal"
  ADD COLUMN "weightKg" DOUBLE PRECISION;
