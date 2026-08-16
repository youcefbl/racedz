-- NATRUN-07.1: sport type per run; existing rows default to RUN.
CREATE TYPE "RunSport" AS ENUM ('RUN', 'WALK', 'TRAIL', 'RIDE');
ALTER TABLE "RunnerRun" ADD COLUMN "sport" "RunSport" NOT NULL DEFAULT 'RUN';
CREATE INDEX "RunnerRun_userId_sport_idx" ON "RunnerRun"("userId", "sport");
