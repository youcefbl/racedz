-- CreateTable
CREATE TABLE IF NOT EXISTS "RaceEditHistory" (
    "id" TEXT NOT NULL,
    "raceEventId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaceEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RaceEditHistory_raceEventId_createdAt_idx" ON "RaceEditHistory"("raceEventId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RaceEditHistory_editorId_idx" ON "RaceEditHistory"("editorId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RaceEditHistory_raceEventId_fkey'
    ) THEN
        ALTER TABLE "RaceEditHistory" ADD CONSTRAINT "RaceEditHistory_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "RaceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RaceEditHistory_editorId_fkey'
    ) THEN
        ALTER TABLE "RaceEditHistory" ADD CONSTRAINT "RaceEditHistory_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
