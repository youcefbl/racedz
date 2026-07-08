-- Add best-effort weather snapshot captured at run save time (Open-Meteo).
ALTER TABLE "RunnerRun" ADD COLUMN "weather" JSONB;
