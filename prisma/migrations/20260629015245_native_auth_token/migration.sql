-- DropIndex
DROP INDEX "RunnerRun_isPublic_averagePace_idx";

-- DropIndex
DROP INDEX "RunnerRun_isPublic_distance_idx";

-- CreateTable
CREATE TABLE "NativeAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NativeAuthToken_token_key" ON "NativeAuthToken"("token");

-- CreateIndex
CREATE INDEX "NativeAuthToken_userId_usedAt_idx" ON "NativeAuthToken"("userId", "usedAt");

-- AddForeignKey
ALTER TABLE "NativeAuthToken" ADD CONSTRAINT "NativeAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
