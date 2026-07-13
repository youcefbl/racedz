-- Social graph (follow), run kudos, and race results — Tier 1 retention/community features.

-- CreateEnum
CREATE TYPE "RaceResultStatus" AS ENUM ('FINISHED', 'DNF', 'DNS', 'DSQ');

-- CreateTable: directed follow edge (follower -> following)
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: kudos (like) on a public run, one per (run, user)
CREATE TABLE "RunKudos" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunKudos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RunKudos_runId_userId_key" ON "RunKudos"("runId", "userId");
CREATE INDEX "RunKudos_userId_idx" ON "RunKudos"("userId");

ALTER TABLE "RunKudos" ADD CONSTRAINT "RunKudos_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RunnerRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RunKudos" ADD CONSTRAINT "RunKudos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: per-runner race result / finish time, recorded after the event
CREATE TABLE "RaceResult" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "finishTimeSeconds" INTEGER,
    "status" "RaceResultStatus" NOT NULL DEFAULT 'FINISHED',
    "overallRank" INTEGER,
    "categoryRank" INTEGER,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaceResult_registrationId_key" ON "RaceResult"("registrationId");
CREATE INDEX "RaceResult_eventId_idx" ON "RaceResult"("eventId");
CREATE INDEX "RaceResult_userId_idx" ON "RaceResult"("userId");

ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "RaceRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RaceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceResult" ADD CONSTRAINT "RaceResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
