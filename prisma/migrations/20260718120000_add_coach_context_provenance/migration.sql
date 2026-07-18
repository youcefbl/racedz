-- Reproducibility metadata for each coach interaction: which context shape-version produced the
-- answer, and a hash of the exact payload sent. Content-free (no prompt / health / GPS stored).

-- AlterTable
ALTER TABLE "CoachInteraction" ADD COLUMN "contextVersion" TEXT;
ALTER TABLE "CoachInteraction" ADD COLUMN "contextHash" TEXT;
