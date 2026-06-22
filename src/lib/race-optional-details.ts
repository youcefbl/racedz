import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export type RaceOptionalDetails = {
  elevationGainText: string | null;
  conditions: string | null;
};

export async function getRaceOptionalDetails(db: PrismaExecutor, raceEventId: string): Promise<RaceOptionalDetails> {
  const rows = await db.$queryRaw<RaceOptionalDetails[]>`
    SELECT "elevationGainText", "conditions"
    FROM "RaceEvent"
    WHERE "id" = ${raceEventId}
    LIMIT 1
  `;

  return rows[0] ?? { elevationGainText: null, conditions: null };
}

export async function setRaceOptionalDetails(db: PrismaExecutor, raceEventId: string, details: RaceOptionalDetails) {
  await db.$executeRaw`
    UPDATE "RaceEvent"
    SET "elevationGainText" = ${details.elevationGainText},
        "conditions" = ${details.conditions}
    WHERE "id" = ${raceEventId}
  `;
}
