-- NATRUN-06.3: derived best efforts per run, computed at save (or one-time backfill), never on read.
ALTER TABLE "RunnerRun" ADD COLUMN "bestEffortsComputedAt" TIMESTAMP(3);

CREATE TABLE "RunBestEffort" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "startIndex" INTEGER NOT NULL,
    "endIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunBestEffort_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RunBestEffort_runId_distanceM_key" ON "RunBestEffort"("runId", "distanceM");
CREATE INDEX "RunBestEffort_userId_distanceM_seconds_idx" ON "RunBestEffort"("userId", "distanceM", "seconds");

ALTER TABLE "RunBestEffort" ADD CONSTRAINT "RunBestEffort_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RunnerRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RunBestEffort" ADD CONSTRAINT "RunBestEffort_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
