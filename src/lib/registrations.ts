import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
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
    return await createRegistration(userId, raceEventId, parsed.data);
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
    include: {
      raceEvent: {
        select: {
          id: true,
          title: true,
          slug: true,
          startDate: true,
          wilaya: true,
          city: true,
          registrationStatus: true,
          status: true
        }
      },
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

    if (race.availablePlaces != null && race.availablePlaces <= 0) {
      throw new RegistrationError("This race is full.");
    }

    if (category.maxParticipants != null) {
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

    if (race.availablePlaces != null) {
      await tx.raceEvent.update({
        where: {
          id: race.id
        },
        data: {
          availablePlaces: {
            decrement: 1
          }
        }
      });
    }

    return registration;
  });
}
