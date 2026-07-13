import "server-only";

import { getPrisma } from "@/lib/db";

// Flip PUBLISHED races whose date has fully passed to COMPLETED so the stored status reflects
// reality (archival, results, "past races" views). A race counts as past once its calendar day is
// over — the same cutoff the public listing uses to hide it (start of today). Multi-day events use
// endDate; single-day events fall back to startDate. Idempotent: already-COMPLETED/CANCELLED/etc.
// races are untouched, so this is safe to run on any schedule.
export async function completePastRaces() {
  const prisma = getPrisma();
  const completed = await prisma.$executeRaw`
    UPDATE "RaceEvent"
    SET "status" = 'COMPLETED'::"RaceStatus", "updatedAt" = NOW()
    WHERE "status" = 'PUBLISHED'::"RaceStatus"
      AND COALESCE("endDate", "startDate") < date_trunc('day', NOW())
  `;

  return { completed };
}
