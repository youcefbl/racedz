-- NATRUN-06.5: manual lap boundaries, bounded JSON.
ALTER TABLE "RunnerRun" ADD COLUMN "laps" JSONB;
