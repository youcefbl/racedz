-- CreateEnum
CREATE TYPE "RunValidity" AS ENUM ('VALID', 'SUSPECT', 'EXCLUDED');

-- AlterTable
ALTER TABLE "RunnerRun" ADD COLUMN     "validity" "RunValidity" NOT NULL DEFAULT 'VALID',
ADD COLUMN     "validityReason" TEXT;
