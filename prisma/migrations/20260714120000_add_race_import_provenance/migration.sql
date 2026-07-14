-- Provenance for races drafted from a shared social-media post via the admin AI importer.
ALTER TABLE "RaceEvent" ADD COLUMN "importSource" TEXT;
ALTER TABLE "RaceEvent" ADD COLUMN "importSourceUrl" TEXT;
ALTER TABLE "RaceEvent" ADD COLUMN "importRawText" TEXT;
ALTER TABLE "RaceEvent" ADD COLUMN "importExtractionJson" JSONB;
