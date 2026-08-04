-- FD1-R02: durable single-flight ownership of a TTS cache key, replacing the lockfile that could
-- expire while the owner was still inside the provider's retry budget and let a second worker make
-- a duplicate paid call.
CREATE TABLE "TtsCacheClaim" (
    "cacheKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TtsCacheClaim_pkey" PRIMARY KEY ("cacheKey")
);

CREATE INDEX "TtsCacheClaim_leaseUntil_idx" ON "TtsCacheClaim"("leaseUntil");
