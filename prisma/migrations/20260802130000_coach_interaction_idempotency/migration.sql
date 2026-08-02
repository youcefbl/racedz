-- Idempotent coach interactions (combined coach review, U-10). A client-generated request key
-- lets a retry after a timeout or a double tap return the original interaction instead of creating
-- a duplicate provider call, quota charge, and answer the client never saw.

ALTER TABLE "CoachInteraction" ADD COLUMN "clientRequestId" TEXT;

-- Unique per user; Postgres treats NULLs as distinct, so keyless (legacy/web-only) requests are
-- unaffected. A concurrent duplicate hits this constraint and the client's retry then receives
-- the stored row via the dedup lookup.
CREATE UNIQUE INDEX "CoachInteraction_userId_clientRequestId_key"
    ON "CoachInteraction"("userId", "clientRequestId");
