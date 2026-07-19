-- Structured long-term coaching memory (Phase 3). One sourced, timestamped fact per row, so the coach
-- can retrieve what is relevant instead of replaying a growing chat transcript into every prompt.
--
-- INJURY_STATUS / RECOVERY_STATUS exist in the enum but must not be written until the health-data
-- privacy/consent/retention policy exists (Phase 0 blocker). Enforced in application code by
-- WRITABLE_MEMORY_KINDS in src/lib/coach/memory.ts.

CREATE TYPE "CoachMemoryKind" AS ENUM (
  'PREFERENCE', 'COACHING_TONE', 'SCHEDULE', 'TERRAIN', 'CONSTRAINT', 'COMMITMENT',
  'STRATEGY_WORKED', 'STRATEGY_FAILED', 'REJECTED_SUGGESTION', 'COACH_NOTE',
  'INJURY_STATUS', 'RECOVERY_STATUS'
);

CREATE TYPE "CoachMemorySource" AS ENUM ('RUNNER_STATED', 'AI_INFERRED', 'SYSTEM_DERIVED', 'HUMAN_COACH');

CREATE TYPE "CoachMemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DISMISSED');

CREATE TABLE "CoachMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "kind" "CoachMemoryKind" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" "CoachMemorySource" NOT NULL,
    "sourceInteractionId" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "CoachMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoachMemory_userId_status_kind_idx" ON "CoachMemory"("userId", "status", "kind");
CREATE INDEX "CoachMemory_userId_kind_key_status_idx" ON "CoachMemory"("userId", "kind", "key", "status");

ALTER TABLE "CoachMemory" ADD CONSTRAINT "CoachMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
