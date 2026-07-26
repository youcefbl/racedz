-- CreateTable
CREATE TABLE "ClientErrorLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "digest" TEXT,
    "route" TEXT NOT NULL,
    "boundary" TEXT,
    "platform" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientErrorLog_createdAt_idx" ON "ClientErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ClientErrorLog_route_createdAt_idx" ON "ClientErrorLog"("route", "createdAt");

-- CreateIndex
CREATE INDEX "ClientErrorLog_userId_createdAt_idx" ON "ClientErrorLog"("userId", "createdAt");
