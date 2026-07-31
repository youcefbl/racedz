-- AlterTable
ALTER TABLE "MobileIdempotencyRecord" ALTER COLUMN "responseCode" DROP NOT NULL,
ALTER COLUMN "responseBody" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MobileSession" ADD COLUMN     "securityStamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

