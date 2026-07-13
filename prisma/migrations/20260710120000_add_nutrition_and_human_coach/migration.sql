-- Nutrition/hydration logging + human-coach review (personal notes from a real coach).

-- Human-coach note interactions authored by an admin/coach.
ALTER TYPE "CoachInteractionType" ADD VALUE IF NOT EXISTS 'HUMAN_NOTE';

-- Author of a human note (null for AI-generated interactions).
ALTER TABLE "CoachInteraction" ADD COLUMN "authorId" TEXT;

-- Whether a subscription includes human-coach review on top of the AI coach.
ALTER TABLE "CoachSubscription" ADD COLUMN "humanCoaching" BOOLEAN NOT NULL DEFAULT false;

-- Daily fuel/hydration log.
CREATE TABLE "NutritionEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loggedFor" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MEAL',
    "mealType" TEXT,
    "description" TEXT,
    "calories" INTEGER,
    "waterMl" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NutritionEntry_userId_loggedFor_idx" ON "NutritionEntry"("userId", "loggedFor");

ALTER TABLE "NutritionEntry" ADD CONSTRAINT "NutritionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
