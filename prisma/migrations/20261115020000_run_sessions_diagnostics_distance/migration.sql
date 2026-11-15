-- CreateEnum
CREATE TYPE "RunDistanceDecision" AS ENUM ('APPLIED', 'KEPT', 'FLAGGED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RunSessionStatus" AS ENUM ('STARTED', 'FINISHED', 'DISCARDED', 'SAVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "DiagnosticKind" AS ENUM ('CRASH', 'PROCESS_EXIT', 'ISSUE');

-- AlterTable
ALTER TABLE "RunnerRun" ADD COLUMN     "deviceDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "distanceAlgoVersion" INTEGER,
ADD COLUMN     "distanceCorrectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RunDistanceEvaluation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "algoVersion" INTEGER NOT NULL,
    "deviceKm" DOUBLE PRECISION NOT NULL,
    "routeKm" DOUBLE PRECISION NOT NULL,
    "routeMovingSeconds" INTEGER,
    "pointCount" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "decision" "RunDistanceDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedKm" DOUBLE PRECISION,
    "sport" "RunSport" NOT NULL,
    "appVersion" TEXT,
    "deviceModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunDistanceEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "RunSessionStatus" NOT NULL DEFAULT 'STARTED',
    "sport" "RunSport" NOT NULL DEFAULT 'RUN',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "startAccuracyM" DOUBLE PRECISION,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "summary" JSONB,
    "device" JSONB,
    "appVersion" TEXT,
    "deviceModel" TEXT,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDiagnosticReport" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT,
    "installId" TEXT,
    "kind" "DiagnosticKind" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT,
    "stackTrace" TEXT,
    "fingerprint" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "buildType" TEXT,
    "deviceManufacturer" TEXT,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "sdkInt" INTEGER,
    "device" JSONB,
    "context" JSONB,
    "runClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDiagnosticReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunDistanceEvaluation_algoVersion_decision_idx" ON "RunDistanceEvaluation"("algoVersion", "decision");

-- CreateIndex
CREATE INDEX "RunDistanceEvaluation_deviceModel_appVersion_idx" ON "RunDistanceEvaluation"("deviceModel", "appVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RunDistanceEvaluation_runId_algoVersion_key" ON "RunDistanceEvaluation"("runId", "algoVersion");

-- CreateIndex
CREATE INDEX "RunSession_status_startedAt_idx" ON "RunSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "RunSession_userId_startedAt_idx" ON "RunSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RunSession_userId_clientId_key" ON "RunSession"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDiagnosticReport_reportId_key" ON "ClientDiagnosticReport"("reportId");

-- CreateIndex
CREATE INDEX "ClientDiagnosticReport_createdAt_idx" ON "ClientDiagnosticReport"("createdAt");

-- CreateIndex
CREATE INDEX "ClientDiagnosticReport_fingerprint_createdAt_idx" ON "ClientDiagnosticReport"("fingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "ClientDiagnosticReport_userId_createdAt_idx" ON "ClientDiagnosticReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientDiagnosticReport_kind_createdAt_idx" ON "ClientDiagnosticReport"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "RunDistanceEvaluation" ADD CONSTRAINT "RunDistanceEvaluation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RunnerRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunSession" ADD CONSTRAINT "RunSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDiagnosticReport" ADD CONSTRAINT "ClientDiagnosticReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

