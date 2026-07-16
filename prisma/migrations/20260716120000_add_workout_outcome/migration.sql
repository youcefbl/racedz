-- Phase 1 (plan adherence): capture how each planned workout actually turned out.
-- WorkoutStatus stays authoritative; these columns describe the outcome.

-- CreateEnum
CREATE TYPE "WorkoutCompletionType" AS ENUM ('AS_PLANNED', 'PARTIAL', 'EASIER_THAN_PLANNED', 'HARDER_THAN_PLANNED');

-- CreateEnum
CREATE TYPE "WorkoutSkipReason" AS ENUM ('SCHEDULE', 'FATIGUE', 'PAIN_OR_SYMPTOMS', 'WEATHER', 'ILLNESS', 'TRAVEL', 'MOTIVATION', 'OTHER');

-- AlterTable
ALTER TABLE "TrainingWorkout" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "TrainingWorkout" ADD COLUMN "completionType" "WorkoutCompletionType";
ALTER TABLE "TrainingWorkout" ADD COLUMN "completionConfidence" DOUBLE PRECISION;
ALTER TABLE "TrainingWorkout" ADD COLUMN "skippedAt" TIMESTAMP(3);
ALTER TABLE "TrainingWorkout" ADD COLUMN "skipReason" "WorkoutSkipReason";
ALTER TABLE "TrainingWorkout" ADD COLUMN "rescheduledFor" TIMESTAMP(3);
ALTER TABLE "TrainingWorkout" ADD COLUMN "runnerNote" TEXT;
