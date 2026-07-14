import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { notifyRaceRegistrationCreated } from "@/lib/notifications";
import { cancelExpiredUnpaidRegistrations } from "@/lib/registration-auto-cancel";
import { raceRegistrationSchema, type RaceRegistrationInput } from "@/lib/validations";

export class RegistrationError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

export async function createRaceRegistrationForUser({
  userId,
  raceEventId,
  input
}: {
  userId: string;
  raceEventId: string;
  input: unknown;
}) {
  const parsed = raceRegistrationSchema.safeParse(input);

  if (!parsed.success) {
    throw new RegistrationError("Check the required registration fields and try again.", 422);
  }

  try {
    const registration = await createRegistration(userId, raceEventId, parsed.data);
    const user = await getPrisma().user.findUnique({
      where: {
        id: userId
      },
      select: {
        email: true
      }
    });

    if (user) {
      await notifyRaceRegistrationCreated({
        userId,
        email: user.email,
        raceId: registration.raceEvent.id,
        raceSlug: registration.raceEvent.slug,
        raceTitle: registration.raceEvent.title,
        categoryName: registration.raceCategory.name
      });
    }

    return registration;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new RegistrationError("You are already registered for this distance.", 409);
    }

    throw error;
  }
}

export async function getUserRegistrations(userId: string) {
  const prisma = getPrisma();

  return prisma.raceRegistration.findMany({
    where: {
      userId
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentProofUrl: true,
      createdAt: true,
      raceEvent: {
        select: {
          id: true,
          title: true,
          slug: true,
          startDate: true,
          wilaya: true,
          city: true,
          registrationStatus: true,
          status: true,
          baridiMobNumber: true,
          ccpAccount: true,
          ccpKey: true,
          paymentNote: true
        }
      },
      raceCategory: {
        select: {
          id: true,
          name: true,
          distanceKm: true,
          priceDzd: true
        }
      },
      result: {
        select: {
          finishTimeSeconds: true,
          status: true,
          overallRank: true,
          categoryRank: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

// One registration owned by the user, with its finisher result + the data a certificate needs.
export async function getUserRegistrationForCertificate(userId: string, registrationId: string) {
  return getPrisma().raceRegistration.findFirst({
    where: { id: registrationId, userId },
    select: {
      id: true,
      bibNumber: true,
      user: { select: { firstName: true, lastName: true, arabicFullName: true } },
      raceEvent: { select: { title: true, startDate: true, wilaya: true, city: true } },
      raceCategory: { select: { name: true, distanceKm: true } },
      result: {
        select: { finishTimeSeconds: true, status: true, overallRank: true, categoryRank: true }
      }
    }
  });
}

export async function getUserRaceRegistration(userId: string, raceEventId: string) {
  const prisma = getPrisma();

  await cancelExpiredUnpaidRegistrations(raceEventId);

  return prisma.raceRegistration.findFirst({
    where: {
      userId,
      raceEventId
    },
    include: {
      raceCategory: {
        select: {
          id: true,
          name: true,
          distanceKm: true,
          priceDzd: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function createRegistration(userId: string, raceEventId: string, input: RaceRegistrationInput) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const race = await tx.raceEvent.findUnique({
      where: {
        id: raceEventId
      },
      include: {
        categories: {
          where: {
            id: input.raceCategoryId
          }
        }
      }
    });

    if (!race) {
      throw new RegistrationError("Race not found.", 404);
    }

    if (race.status !== "PUBLISHED" || race.registrationStatus !== "OPEN") {
      throw new RegistrationError("Registration is not available for this race.");
    }

    if (race.registrationCloseAt && race.registrationCloseAt < new Date()) {
      throw new RegistrationError("Registration is closed for this race.");
    }

    const category = race.categories[0];

    if (!category) {
      throw new RegistrationError("Race distance not found.", 404);
    }

    // Capacity enforcement has to be atomic against concurrent registrations for the same
    // distance (registration-open thundering-herd). Take a row lock on the category so the
    // count()-then-insert below can't be run by two transactions on a stale count and both
    // overshoot maxParticipants. The lock is released when the transaction commits/rolls back;
    // registrations for other categories lock different rows, so they don't contend.
    if (category.maxParticipants != null) {
      await tx.$queryRaw`SELECT "id" FROM "RaceCategory" WHERE "id" = ${category.id} FOR UPDATE`;

      const categoryRegistrationCount = await tx.raceRegistration.count({
        where: {
          raceCategoryId: category.id,
          status: {
            notIn: ["CANCELLED", "REJECTED"]
          }
        }
      });

      if (categoryRegistrationCount >= category.maxParticipants) {
        throw new RegistrationError("This distance is full.");
      }
    }

    // Claim an event-level place atomically: the guarded UPDATE decrements only while places
    // remain, so it can never go negative even under concurrent registrations (the earlier
    // `race.availablePlaces` read is stale by the time we get here). A rollback (e.g. the
    // unique-constraint conflict below) restores the place. Cancellations increment it back
    // (see organizer.ts), matching this countdown.
    if (race.availablePlaces != null) {
      const claimed = await tx.raceEvent.updateMany({
        where: {
          id: race.id,
          availablePlaces: {
            gt: 0
          }
        },
        data: {
          availablePlaces: {
            decrement: 1
          }
        }
      });

      if (claimed.count === 0) {
        throw new RegistrationError("This race is full.");
      }
    }

    await tx.user.update({
      where: {
        id: userId
      },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        gender: input.gender,
        dateOfBirth: new Date(input.dateOfBirth),
        wilaya: input.wilaya,
        city: input.city
      }
    });

    const registration = await tx.raceRegistration.create({
      data: {
        userId,
        raceEventId: race.id,
        raceCategoryId: category.id,
        status: "PENDING",
        paymentStatus: category.priceDzd && category.priceDzd > 0 ? "PENDING" : "NOT_REQUIRED",
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        clubName: input.clubName || undefined,
        tshirtSize: input.tshirtSize || undefined
      },
      include: {
        raceEvent: true,
        raceCategory: true
      }
    });

    return registration;
  }, {
    // Capacity enforcement serializes concurrent registrations for the same race on a row lock
    // (the FOR UPDATE above / the guarded availablePlaces UPDATE). Each transaction is tiny, but a
    // registration-open herd can queue many deep — give it more than Prisma's default 5s so waiters
    // drain into a clean "full" rejection instead of a spurious P2028 timeout. A Cloudflare waiting
    // room in front of the open moment is the real fix for extreme spikes.
    maxWait: 10_000,
    timeout: 20_000
  });
}
