-- Add opt-in TOTP two-factor authentication fields to User.
ALTER TABLE "User"
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfaSecret" TEXT,
  ADD COLUMN "mfaBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
