-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CoachTipCategory" ADD VALUE 'INTERMEDIATE';
ALTER TYPE "CoachTipCategory" ADD VALUE 'SPEED';
ALTER TYPE "CoachTipCategory" ADD VALUE 'TRAIL';
ALTER TYPE "CoachTipCategory" ADD VALUE 'FITNESS';
ALTER TYPE "CoachTipCategory" ADD VALUE 'INJURY_PRONE';
