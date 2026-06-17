ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

ALTER TABLE "RaceCategory"
ADD COLUMN IF NOT EXISTS "raceType" "RaceType";

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "summary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorId_createdAt_idx"
ON "AdminAuditLog" ("actorId", "createdAt");

CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_createdAt_idx"
ON "AdminAuditLog" ("targetType", "targetId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminAuditLog_actorId_fkey'
  ) THEN
    ALTER TABLE "AdminAuditLog"
    ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
