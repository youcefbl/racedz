-- Allow runners to share runs publicly (for per-wilaya leaderboards).
ALTER TABLE "RunnerRun" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- Indexes to keep leaderboard queries fast.
CREATE INDEX "RunnerRun_isPublic_averagePace_idx" ON "RunnerRun"("isPublic", "averagePaceSecondsPerKm");
CREATE INDEX "RunnerRun_isPublic_distance_idx" ON "RunnerRun"("isPublic", "distanceKm");
