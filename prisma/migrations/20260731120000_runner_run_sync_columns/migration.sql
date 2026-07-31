-- AlterTable
ALTER TABLE "RunnerRun" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "RunnerRun_userId_updatedAt_idx" ON "RunnerRun"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RunnerRun_userId_clientId_key" ON "RunnerRun"("userId", "clientId");

