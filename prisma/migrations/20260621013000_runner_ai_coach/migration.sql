CREATE TYPE "CoachGoalType" AS ENUM ('GENERAL_FITNESS', 'FIVE_K', 'TEN_K', 'HALF_MARATHON', 'MARATHON', 'TRAIL', 'OTHER');
CREATE TYPE "RunnerExperience" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "CoachGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RunnerRunSource" AS ENUM ('MANUAL', 'IMPORTED');
CREATE TYPE "TrainingPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TrainingPlanSource" AS ENUM ('RULE_BASED', 'AI_ASSISTED', 'MANUAL');
CREATE TYPE "CoachWorkoutType" AS ENUM ('EASY', 'LONG_RUN', 'TEMPO', 'INTERVAL', 'RECOVERY', 'REST', 'CROSS_TRAINING', 'RACE');
CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'COMPLETED', 'SKIPPED', 'CANCELLED');
CREATE TYPE "CoachInteractionType" AS ENUM ('INITIAL_PLAN', 'POST_RUN', 'WEEKLY_REVIEW', 'CHAT');
CREATE TYPE "CoachInteractionStatus" AS ENUM ('PENDING', 'COMPLETED', 'BLOCKED', 'FAILED');
CREATE TYPE "AiRequestStatus" AS ENUM ('SUCCEEDED', 'FAILED');

CREATE TABLE "RunnerGoal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "raceEventId" TEXT,
  "goalType" "CoachGoalType" NOT NULL,
  "customGoal" TEXT,
  "targetDate" TIMESTAMP(3) NOT NULL,
  "targetDistanceKm" DOUBLE PRECISION,
  "targetTimeSeconds" INTEGER,
  "experienceLevel" "RunnerExperience" NOT NULL,
  "currentWeeklyDistanceKm" DOUBLE PRECISION NOT NULL,
  "availableTrainingDays" INTEGER[] NOT NULL,
  "preferredLongRunDay" INTEGER,
  "constraints" TEXT,
  "injuryNotes" TEXT,
  "preferredLocale" TEXT NOT NULL DEFAULT 'en',
  "status" "CoachGoalStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RunnerGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "startsOn" TIMESTAMP(3) NOT NULL,
  "endsOn" TIMESTAMP(3) NOT NULL,
  "status" "TrainingPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "TrainingPlanSource" NOT NULL DEFAULT 'AI_ASSISTED',
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingWorkout" (
  "id" TEXT NOT NULL,
  "trainingPlanId" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "workoutType" "CoachWorkoutType" NOT NULL,
  "title" TEXT NOT NULL,
  "targetDistanceKm" DOUBLE PRECISION,
  "targetDurationMin" INTEGER,
  "intensity" TEXT NOT NULL,
  "instructions" TEXT NOT NULL,
  "status" "WorkoutStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingWorkout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RunnerRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goalId" TEXT,
  "workoutId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "distanceKm" DOUBLE PRECISION NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "averagePaceSecondsPerKm" INTEGER NOT NULL,
  "elevationGainM" INTEGER,
  "averageHeartRate" INTEGER,
  "perceivedEffort" INTEGER NOT NULL,
  "fatigueLevel" INTEGER NOT NULL DEFAULT 0,
  "painLevel" INTEGER NOT NULL DEFAULT 0,
  "symptoms" TEXT,
  "notes" TEXT,
  "source" "RunnerRunSource" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RunnerRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoachSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goalId" TEXT,
  "metrics" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoachSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoachInteraction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goalId" TEXT,
  "runId" TEXT,
  "type" "CoachInteractionType" NOT NULL,
  "status" "CoachInteractionStatus" NOT NULL DEFAULT 'PENDING',
  "userMessage" TEXT,
  "response" JSONB,
  "safety" JSONB NOT NULL,
  "model" TEXT,
  "promptVersion" TEXT NOT NULL,
  "errorCode" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CoachInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsageLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "interactionId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "providerResponseId" TEXT,
  "model" TEXT NOT NULL,
  "status" "AiRequestStatus" NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostMicroUsd" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RunnerGoal_userId_status_idx" ON "RunnerGoal"("userId", "status");
CREATE INDEX "RunnerGoal_raceEventId_idx" ON "RunnerGoal"("raceEventId");
CREATE UNIQUE INDEX "TrainingPlan_goalId_version_key" ON "TrainingPlan"("goalId", "version");
CREATE INDEX "TrainingPlan_userId_status_startsOn_idx" ON "TrainingPlan"("userId", "status", "startsOn");
CREATE INDEX "TrainingWorkout_trainingPlanId_scheduledFor_idx" ON "TrainingWorkout"("trainingPlanId", "scheduledFor");
CREATE UNIQUE INDEX "RunnerRun_workoutId_key" ON "RunnerRun"("workoutId");
CREATE INDEX "RunnerRun_userId_startedAt_idx" ON "RunnerRun"("userId", "startedAt");
CREATE INDEX "RunnerRun_goalId_startedAt_idx" ON "RunnerRun"("goalId", "startedAt");
CREATE UNIQUE INDEX "CoachSnapshot_userId_key" ON "CoachSnapshot"("userId");
CREATE INDEX "CoachSnapshot_goalId_idx" ON "CoachSnapshot"("goalId");
CREATE INDEX "CoachInteraction_userId_createdAt_idx" ON "CoachInteraction"("userId", "createdAt");
CREATE INDEX "CoachInteraction_goalId_type_createdAt_idx" ON "CoachInteraction"("goalId", "type", "createdAt");
CREATE INDEX "CoachInteraction_runId_idx" ON "CoachInteraction"("runId");
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");
CREATE INDEX "AiUsageLog_interactionId_idx" ON "AiUsageLog"("interactionId");
CREATE INDEX "AiUsageLog_status_createdAt_idx" ON "AiUsageLog"("status", "createdAt");

ALTER TABLE "RunnerGoal" ADD CONSTRAINT "RunnerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RunnerGoal" ADD CONSTRAINT "RunnerGoal_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "RaceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "RunnerGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingWorkout" ADD CONSTRAINT "TrainingWorkout_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RunnerRun" ADD CONSTRAINT "RunnerRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RunnerRun" ADD CONSTRAINT "RunnerRun_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "RunnerGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RunnerRun" ADD CONSTRAINT "RunnerRun_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "TrainingWorkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoachSnapshot" ADD CONSTRAINT "CoachSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachSnapshot" ADD CONSTRAINT "CoachSnapshot_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "RunnerGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoachInteraction" ADD CONSTRAINT "CoachInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachInteraction" ADD CONSTRAINT "CoachInteraction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "RunnerGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoachInteraction" ADD CONSTRAINT "CoachInteraction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RunnerRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "CoachInteraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
