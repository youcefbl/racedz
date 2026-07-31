-- Revoke every mobile session that existed before `securityStamp` was introduced.
--
-- The previous migration backfilled those rows with CURRENT_TIMESTAMP, which is NEWER than the
-- user's own securityStampAt. The refresh check only rejects a session whose stamp is OLDER than
-- the user's, so a device whose owner had already reset their password kept a working refresh
-- token — exactly the bypass that column was added to close. There is no value that can be
-- backfilled safely, because we cannot know whether a given session predates the user's last
-- stamp change; forcing those devices to sign in again is the only sound answer.
UPDATE "MobileSession"
SET "revokedAt" = NOW(), "revokedReason" = 'MIGRATION_SECURITY_STAMP'
WHERE "revokedAt" IS NULL;

-- Now that no row relies on it, drop the backfill default so every insert must state the stamp it
-- authenticated against.
ALTER TABLE "MobileSession" ALTER COLUMN "securityStamp" DROP DEFAULT;

-- Idempotency reservations gain an owner so a stalled attempt cannot overwrite the result of the
-- attempt that took over its lease. Existing rows are discarded rather than backfilled: they are
-- short-lived replay records, and losing one only means a retry re-runs the mutation, which the
-- registration unique constraint still guards.
DELETE FROM "MobileIdempotencyRecord";
ALTER TABLE "MobileIdempotencyRecord" ADD COLUMN "owner" TEXT NOT NULL;
