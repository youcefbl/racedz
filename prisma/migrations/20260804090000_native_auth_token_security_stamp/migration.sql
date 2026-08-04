-- FD1-R01: bind every native-auth token to the security stamp in force when it was minted, so a
-- token created before a password reset / MFA change / block cannot be exchanged afterwards.
--
-- Nullable with no default on purpose: NULL means "minted before this column existed, or by code
-- that forgot to set it" and is rejected at exchange. A DEFAULT would silently mint tokens that
-- look freshly authenticated. Live tokens expire in 5 minutes, so no backfill is meaningful.
ALTER TABLE "NativeAuthToken" ADD COLUMN "securityStampAt" TIMESTAMP(3);
