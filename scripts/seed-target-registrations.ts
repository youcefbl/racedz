import { PrismaClient, type PaymentStatus, type Prisma, type RegistrationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const TARGETS = [
  {
    raceEventId: "cmqjkq54a00022e1li4pgswfz",
    targetRegistrations: 5000
  },
  {
    raceEventId: "cmqj9zw8p000c14noz2c9lw2n",
    targetRegistrations: 50
  }
] as const;

const BATCH_SIZE = 1000;
const CLUBS = ["Open Runner", "Blida Runners", "Alger Road Crew", "Trail DZ", "Independent"];
const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL"];

async function main() {
  for (const target of TARGETS) {
    await seedRaceRegistrations(target.raceEventId, target.targetRegistrations);
  }
}

async function seedRaceRegistrations(raceEventId: string, targetRegistrations: number) {
  const race = await prisma.raceEvent.findUnique({
    where: { id: raceEventId },
    include: {
      categories: {
        orderBy: [{ distanceKm: "asc" }, { createdAt: "asc" }],
        include: {
          _count: {
            select: { registrations: true }
          }
        }
      },
      _count: {
        select: { registrations: true }
      }
    }
  });

  if (!race) {
    throw new Error(`Race not found: ${raceEventId}`);
  }

  const category = race.categories[0];

  if (!category) {
    throw new Error(`Race has no categories: ${race.title} (${raceEventId})`);
  }

  const existingCount = category._count.registrations;
  const missingCount = Math.max(targetRegistrations - existingCount, 0);

  if (missingCount === 0) {
    console.info(`${race.title}: already has ${existingCount}/${targetRegistrations} registrations for ${category.name}.`);
    return;
  }

  const existingUserIds = await prisma.raceRegistration.findMany({
    where: { raceCategoryId: category.id },
    select: { userId: true }
  });
  const existingUserIdSet = new Set(existingUserIds.map((registration) => registration.userId));

  const availableUsers = await prisma.user.findMany({
    where: {
      email: { startsWith: "seeded-user-" },
      role: "RUNNER"
    },
    orderBy: { email: "asc" },
    select: { id: true }
  });
  const users = availableUsers.filter((user) => !existingUserIdSet.has(user.id)).slice(0, missingCount);

  if (users.length < missingCount) {
    throw new Error(
      `Not enough seeded runner users for ${race.title}. Need ${missingCount}, found ${users.length}. Run npm run prisma:seed first.`
    );
  }

  let inserted = 0;

  for (let offset = 0; offset < users.length; offset += BATCH_SIZE) {
    const batchUsers = users.slice(offset, offset + BATCH_SIZE);
    const data = batchUsers.map((user, index) =>
      buildRegistration({
        userId: user.id,
        raceEventId: race.id,
        raceCategoryId: category.id,
        sequence: existingCount + offset + index + 1
      })
    );

    const result = await prisma.raceRegistration.createMany({
      data,
      skipDuplicates: true
    });

    inserted += result.count;
    console.info(`${race.title}: inserted ${inserted}/${missingCount} registrations`);
  }

  console.info(`${race.title}: now targeted at ${existingCount + inserted}/${targetRegistrations} registrations for ${category.name}.`);
}

function buildRegistration({
  userId,
  raceEventId,
  raceCategoryId,
  sequence
}: {
  userId: string;
  raceEventId: string;
  raceCategoryId: string;
  sequence: number;
}): Prisma.RaceRegistrationCreateManyInput {
  const status = pickWeightedStatus(sequence);
  const paymentStatus = pickPaymentStatus(status, sequence);

  return {
    userId,
    raceEventId,
    raceCategoryId,
    bibNumber: status === "CONFIRMED" ? `RDZ-${String(sequence).padStart(5, "0")}` : null,
    status,
    paymentStatus,
    paymentMethod: paymentStatus === "NOT_REQUIRED" ? null : "BARIDIMOB",
    emergencyContactName: "Seeded Emergency Contact",
    emergencyContactPhone: "+213555000000",
    clubName: CLUBS[sequence % CLUBS.length],
    tshirtSize: TSHIRT_SIZES[sequence % TSHIRT_SIZES.length],
    notes: "Generated local registration seed data"
  };
}

function pickWeightedStatus(sequence: number): RegistrationStatus {
  const value = sequence % 10;

  if (value < 7) {
    return "CONFIRMED";
  }

  if (value < 9) {
    return "PENDING";
  }

  return "WAITING_LIST";
}

function pickPaymentStatus(status: RegistrationStatus, sequence: number): PaymentStatus {
  if (status === "CONFIRMED") {
    return sequence % 5 === 0 ? "MANUAL_REVIEW" : "PAID";
  }

  if (status === "WAITING_LIST") {
    return "PENDING";
  }

  return sequence % 3 === 0 ? "MANUAL_REVIEW" : "PENDING";
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
