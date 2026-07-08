-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" TEXT,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "theme" TEXT;

-- Backfill: treat all pre-existing accounts as already onboarded so the first-login
-- welcome only shows to genuinely new sign-ups from here on.
UPDATE "User" SET "onboardedAt" = COALESCE("firstLoginAt", "createdAt") WHERE "onboardedAt" IS NULL;
