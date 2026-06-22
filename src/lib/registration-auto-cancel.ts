import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

type ExpiredRegistrationRow = {
  id: string;
  raceEventId: string;
};

export async function cancelExpiredUnpaidRegistrations(raceEventId?: string) {
  const prisma = getPrisma();
  const raceFilter = raceEventId ? Prisma.sql`AND race."id" = ${raceEventId}` : Prisma.empty;
  const expired = await prisma.$queryRaw<ExpiredRegistrationRow[]>`
    SELECT registration."id", registration."raceEventId"
    FROM "RaceRegistration" registration
    INNER JOIN "RaceEvent" race ON race."id" = registration."raceEventId"
    WHERE race."autoCancelUnpaidAfterHours" IS NOT NULL
      AND registration."status" = 'PENDING'::"RegistrationStatus"
      AND registration."paymentStatus" IN ('PENDING'::"PaymentStatus", 'FAILED'::"PaymentStatus")
      AND registration."createdAt" <= NOW() - (race."autoCancelUnpaidAfterHours" * INTERVAL '1 hour')
      ${raceFilter}
  `;

  if (expired.length === 0) {
    return { cancelled: 0 };
  }

  const ids = expired.map((registration) => registration.id);
  const cancelledByRaceId = new Map<string, number>();

  for (const registration of expired) {
    cancelledByRaceId.set(registration.raceEventId, (cancelledByRaceId.get(registration.raceEventId) ?? 0) + 1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.raceRegistration.updateMany({
      where: {
        id: {
          in: ids
        }
      },
      data: {
        status: "CANCELLED"
      }
    });

    for (const [id, count] of cancelledByRaceId) {
      await tx.raceEvent.updateMany({
        where: {
          id,
          availablePlaces: {
            not: null
          }
        },
        data: {
          availablePlaces: {
            increment: count
          }
        }
      });
    }
  });

  return { cancelled: expired.length };
}

export async function getRaceAutoCancelUnpaidAfterHours(raceEventId: string) {
  const rows = await getPrisma().$queryRaw<Array<{ autoCancelUnpaidAfterHours: number | null }>>`
    SELECT "autoCancelUnpaidAfterHours"
    FROM "RaceEvent"
    WHERE "id" = ${raceEventId}
    LIMIT 1
  `;

  return rows[0]?.autoCancelUnpaidAfterHours ?? null;
}

export async function setRaceAutoCancelUnpaidAfterHours(
  tx: Pick<ReturnType<typeof getPrisma>, "$executeRaw">,
  raceEventId: string,
  hours: number | null
) {
  await tx.$executeRaw`
    UPDATE "RaceEvent"
    SET "autoCancelUnpaidAfterHours" = ${hours}
    WHERE "id" = ${raceEventId}
  `;
}
