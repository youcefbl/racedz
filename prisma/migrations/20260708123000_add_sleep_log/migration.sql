-- Sleep tracking for runners: one row per calendar night, upserted.
CREATE TYPE "SleepLogSource" AS ENUM ('MANUAL', 'PARSED');

CREATE TABLE "SleepLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "night" DATE NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bedTime" TEXT,
    "wakeTime" TEXT,
    "note" TEXT,
    "source" "SleepLogSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SleepLog_userId_night_key" ON "SleepLog"("userId", "night");
CREATE INDEX "SleepLog_userId_night_idx" ON "SleepLog"("userId", "night");

ALTER TABLE "SleepLog" ADD CONSTRAINT "SleepLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
