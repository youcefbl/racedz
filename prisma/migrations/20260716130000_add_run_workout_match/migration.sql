-- Phase 1.3 (plan adherence): record how a run got linked to a planned workout, so bad
-- auto-links are auditable and the match quality is measurable.

-- CreateEnum
CREATE TYPE "WorkoutMatchSource" AS ENUM ('EXPLICIT', 'AUTO', 'RUNNER_CONFIRMED');

-- AlterTable
ALTER TABLE "RunnerRun" ADD COLUMN "workoutMatchSource" "WorkoutMatchSource";
ALTER TABLE "RunnerRun" ADD COLUMN "workoutMatchConfidence" DOUBLE PRECISION;
