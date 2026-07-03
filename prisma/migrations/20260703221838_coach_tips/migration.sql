-- CreateEnum
CREATE TYPE "CoachTipCategory" AS ENUM ('GENERAL', 'BEGINNER', 'HEAVY_WEIGHT', 'EXPERIENCED', 'MARATHON');

-- CreateEnum
CREATE TYPE "CoachTipStatus" AS ENUM ('PROPOSED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CoachTipSource" AS ENUM ('MANUAL', 'AI');

-- CreateTable
CREATE TABLE "CoachTip" (
    "id" TEXT NOT NULL,
    "category" "CoachTipCategory" NOT NULL,
    "status" "CoachTipStatus" NOT NULL DEFAULT 'PROPOSED',
    "source" "CoachTipSource" NOT NULL DEFAULT 'MANUAL',
    "textEn" TEXT NOT NULL,
    "textFr" TEXT NOT NULL,
    "textAr" TEXT NOT NULL,
    "proposedByModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachTip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachTip_status_category_idx" ON "CoachTip"("status", "category");
