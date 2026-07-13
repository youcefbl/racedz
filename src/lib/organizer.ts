import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { buildPaginationMeta, parsePagination, type PaginatedResult, type PaginationParams } from "@/lib/pagination";
import { createUniqueRaceSlug } from "@/lib/race-slugs";
import type { RaceResultStatusValue } from "@/lib/race-results";
import { getRaceOptionalDetails, setRaceOptionalDetails } from "@/lib/race-optional-details";
import {
  cancelExpiredUnpaidRegistrations,
  getRaceAutoCancelUnpaidAfterHours,
  setRaceAutoCancelUnpaidAfterHours
} from "@/lib/registration-auto-cancel";
import {
  organizationInviteSchema,
  organizationProfileSchema,
  organizerCategorySchema,
  organizerRaceSchema,
  organizerRaceUpdateSchema
} from "@/lib/validations";

type OrganizationInvitationRow = {
  id: string;
  organizationId: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  invitedById: string;
  token: string;
  createdAt: Date;
  acceptedAt: Date | null;
};

type OrganizerRegistrationRow = Prisma.RaceRegistrationGetPayload<{
  include: {
    user: {
      select: {
        firstName: true;
        lastName: true;
        email: true;
        phone: true;
      };
    };
    raceCategory: {
      select: {
        name: true;
        distanceKm: true;
        priceDzd: true;
      };
    };
    result: true;
  };
}>;

export type OrganizationInvitationDetail = OrganizationInvitationRow & {
  organizationName: string;
  organizationStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  organizationSlug: string;
  invitedByName: string;
};

export class OrganizerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizerError";
  }
}

export async function requireApprovedOrganizer() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/organizer");
  }

  const membership = await getPrisma().organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: {
        status: "APPROVED"
      }
    },
    include: {
      organization: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!membership && session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    redirect("/organizer/request");
  }

  if (!membership) {
    throw new OrganizerError("No approved organization found for this user.");
  }

  return {
    session,
    membership,
    organization: membership.organization
  };
}

export async function getOrganizerDashboardData(userId: string) {
  const membership = await getPrisma().organizationMember.findFirst({
    where: {
      userId,
      organization: {
        status: "APPROVED"
      }
    },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              members: true,
              races: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    return null;
  }

  const [pendingRaces, publishedRaces, registrations, manualReviews, invitations] = await Promise.all([
    getPrisma().raceEvent.count({
      where: {
        organizationId: membership.organizationId,
        status: "PENDING_REVIEW"
      }
    }),
    getPrisma().raceEvent.count({
      where: {
        organizationId: membership.organizationId,
        status: "PUBLISHED"
      }
    }),
    getPrisma().raceRegistration.count({
      where: {
        raceEvent: {
          organizationId: membership.organizationId
        }
      }
    }),
    getPrisma().raceRegistration.count({
      where: {
        paymentStatus: "MANUAL_REVIEW",
        raceEvent: {
          organizationId: membership.organizationId
        }
      }
    }),
    countOrganizationInvitations(membership.organizationId)
  ]);

  return {
    membership,
    organization: membership.organization,
    stats: {
      pendingRaces,
      publishedRaces,
      registrations,
      manualReviews,
      invitations
    }
  };
}

export async function getOrganizerRaces(organizationId: string) {
  return getPrisma().raceEvent.findMany({
    where: {
      organizationId
    },
    include: {
      categories: {
        orderBy: {
          distanceKm: "asc"
        }
      },
      _count: {
        select: {
          registrations: true,
          categories: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getOrganizerRaceById(organizationId: string, raceEventId: string) {
  const race = await getPrisma().raceEvent.findFirst({
    where: {
      id: raceEventId,
      organizationId
    },
    include: {
      categories: {
        orderBy: {
          distanceKm: "asc"
        }
      },
      _count: {
        select: {
          categories: true,
          registrations: true
        }
      }
    }
  });

  if (!race) {
    return null;
  }

  const raceTypeByCategoryId = await getCategoryRaceTypes(race.categories.map((category) => category.id));
  const autoCancelUnpaidAfterHours = await getRaceAutoCancelUnpaidAfterHours(race.id);
  const optionalDetails = await getRaceOptionalDetails(getPrisma(), race.id);

  return {
    ...race,
    ...optionalDetails,
    autoCancelUnpaidAfterHours,
    categories: race.categories.map((category) => ({
      ...category,
      raceType: raceTypeByCategoryId.get(category.id) ?? race.raceType
    }))
  };
}

export async function getOrganizerRaceRegistrations(
  organizationId: string,
  raceEventId: string,
  filters: { q?: string; status?: string; paymentState?: string } = {},
  pagination?: PaginationParams
): Promise<PaginatedResult<OrganizerRegistrationRow>> {
  const prisma = getPrisma();
  const q = filters.q?.trim();
  const { page, limit, skip } = pagination ?? parsePagination();

  await cancelExpiredUnpaidRegistrations(raceEventId);

  const where: Prisma.RaceRegistrationWhereInput = {
    raceEventId,
    raceEvent: {
      organizationId
    },
    status: isRegistrationStatus(filters.status) ? filters.status : undefined,
    OR: q
      ? [
          { user: { email: { contains: q, mode: "insensitive" } } },
          { user: { firstName: { contains: q, mode: "insensitive" } } },
          { user: { lastName: { contains: q, mode: "insensitive" } } },
          { raceCategory: { name: { contains: q, mode: "insensitive" } } }
        ]
      : undefined
  };

  applyPaymentStateFilter(where, filters.paymentState);

  const [registrations, total] = await Promise.all([
    prisma.raceRegistration.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        raceCategory: {
          select: {
            name: true,
            distanceKm: true,
            priceDzd: true
          }
        },
        result: true
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: limit
    }),
    prisma.raceRegistration.count({ where })
  ]);

  return {
    items: registrations,
    ...buildPaginationMeta(total, page, limit)
  };
}

export async function confirmOrganizerRegistrationPayment({
  organizationId,
  registrationId
}: {
  organizationId: string;
  registrationId: string;
}) {
  const registration = await getPrisma().raceRegistration.findFirst({
    where: {
      id: registrationId,
      raceEvent: {
        organizationId
      }
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!registration) {
    throw new OrganizerError("Registration not found for this organization.");
  }

  if (registration.status === "CANCELLED" || registration.status === "REJECTED") {
    throw new OrganizerError("Payment cannot be confirmed for a cancelled or rejected registration.");
  }

  return getPrisma().raceRegistration.update({
    where: {
      id: registration.id
    },
    data: {
      paymentStatus: "PAID"
    }
  });
}

// Record (or update) the race result for one registration the organizer owns. Passing a null
// finish time with status FINISHED clears any recorded time; other statuses (DNF/DNS/DSQ) are
// kept without a time. Upserts so re-saving edits the existing result.
export async function saveOrganizerRaceResult({
  organizationId,
  registrationId,
  recordedById,
  finishTimeSeconds,
  status,
  notes
}: {
  organizationId: string;
  registrationId: string;
  recordedById: string;
  finishTimeSeconds: number | null;
  status: RaceResultStatusValue;
  notes?: string | null;
}) {
  const registration = await getPrisma().raceRegistration.findFirst({
    where: { id: registrationId, raceEvent: { organizationId } },
    select: { id: true, userId: true, raceEventId: true }
  });

  if (!registration) {
    throw new OrganizerError("Registration not found for this organization.");
  }

  const timeSeconds = status === "FINISHED" ? finishTimeSeconds : null;

  return getPrisma().raceResult.upsert({
    where: { registrationId },
    create: {
      registrationId,
      eventId: registration.raceEventId,
      userId: registration.userId,
      finishTimeSeconds: timeSeconds,
      status,
      notes: notes?.trim() || null,
      recordedById
    },
    update: {
      finishTimeSeconds: timeSeconds,
      status,
      notes: notes?.trim() || null,
      recordedById
    }
  });
}

export async function cancelOrganizerRaceRegistration({
  organizationId,
  registrationId
}: {
  organizationId: string;
  registrationId: string;
}) {
  return getPrisma().$transaction(async (tx) => {
    const registration = await tx.raceRegistration.findFirst({
      where: {
        id: registrationId,
        raceEvent: {
          organizationId
        }
      },
      select: {
        id: true,
        status: true,
        raceEventId: true,
        raceEvent: {
          select: {
            availablePlaces: true
          }
        }
      }
    });

    if (!registration) {
      throw new OrganizerError("Registration not found for this organization.");
    }

    if (registration.status === "CANCELLED") {
      return registration;
    }

    await tx.raceRegistration.update({
      where: {
        id: registration.id
      },
      data: {
        status: "CANCELLED"
      }
    });

    if (registration.status !== "REJECTED" && registration.raceEvent.availablePlaces != null) {
      await tx.raceEvent.update({
        where: {
          id: registration.raceEventId
        },
        data: {
          availablePlaces: {
            increment: 1
          }
        }
      });
    }

    return registration;
  });
}

export async function getOrganizerMembers(organizationId: string) {
  const organization = await getPrisma().organization.findUnique({
    where: {
      id: organizationId
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!organization) {
    return null;
  }

  const invitations = await getOrganizationInvitations(organizationId);

  return {
    ...organization,
    invitations
  };
}

export type OrganizationProfile = {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  website: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  wilaya: string | null;
  city: string | null;
  commune: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
};

export async function getOrganizationProfile(organizationId: string) {
  const rows = await getPrisma().$queryRaw<OrganizationProfile[]>`
    SELECT
      "id",
      "name",
      "description",
      "email",
      "phone",
      "logoUrl",
      "website",
      "facebookUrl",
      "instagramUrl",
      "wilaya",
      "city",
      "commune",
      "status"
    FROM "Organization"
    WHERE "id" = ${organizationId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function updateOrganizationProfile({
  organizationId,
  actorRole,
  input
}: {
  organizationId: string;
  actorRole: "OWNER" | "ADMIN" | "MEMBER";
  input: unknown;
}) {
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") {
    throw new OrganizerError("Only organization owners and admins can update organization settings.");
  }

  const parsed = organizationProfileSchema.safeParse(input);

  if (!parsed.success) {
    throw new OrganizerError("Check the organization profile fields and try again.");
  }

  const rows = await getPrisma().$queryRaw<OrganizationProfile[]>`
    UPDATE "Organization"
    SET
      "name" = ${parsed.data.name},
      "description" = ${parsed.data.description},
      "email" = ${parsed.data.email},
      "phone" = ${parsed.data.phone},
      "logoUrl" = ${parsed.data.logoUrl ?? null},
      "website" = ${parsed.data.website ?? null},
      "facebookUrl" = ${parsed.data.facebookUrl ?? null},
      "instagramUrl" = ${parsed.data.instagramUrl ?? null},
      "wilaya" = ${parsed.data.wilaya},
      "city" = ${parsed.data.city},
      "commune" = ${parsed.data.commune ?? null},
      "updatedAt" = NOW()
    WHERE "id" = ${organizationId}
    RETURNING
      "id",
      "name",
      "description",
      "email",
      "phone",
      "logoUrl",
      "website",
      "facebookUrl",
      "instagramUrl",
      "wilaya",
      "city",
      "commune",
      "status"
  `;

  if (!rows[0]) {
    throw new OrganizerError("Organization not found.");
  }

  return rows[0];
}

export async function inviteOrganizationUser({
  organizationId,
  invitedById,
  input
}: {
  organizationId: string;
  invitedById: string;
  input: unknown;
}) {
  const parsed = organizationInviteSchema.safeParse(input);

  if (!parsed.success) {
    throw new OrganizerError("Enter a valid email and role.");
  }

  const existingUser = await getPrisma().user.findUnique({
    where: {
      email: parsed.data.email
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    const existingMember = await getPrisma().organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId
        }
      }
    });

    if (existingMember) {
      throw new OrganizerError("This user is already a member of the organization.");
    }
  }

  return upsertOrganizationInvitation({
    organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedById
  });
}

export async function revokeOrganizationInvitation({
  organizationId,
  invitationId
}: {
  organizationId: string;
  invitationId: string;
}) {
  const invitation = await getOrganizationInvitationForManagement({ organizationId, invitationId });

  if (!invitation) {
    throw new OrganizerError("Invitation not found.");
  }

  if (invitation.status !== "PENDING") {
    throw new OrganizerError("Only pending invitations can be revoked.");
  }

  await getPrisma().$executeRaw`
    UPDATE "OrganizationInvitation"
    SET "status" = 'REVOKED'::"InvitationStatus"
    WHERE "id" = ${invitationId}
      AND "organizationId" = ${organizationId}
  `;
}

export async function resendOrganizationInvitation({
  organizationId,
  invitationId,
  invitedById
}: {
  organizationId: string;
  invitationId: string;
  invitedById: string;
}) {
  const invitation = await getOrganizationInvitationForManagement({ organizationId, invitationId });

  if (!invitation) {
    throw new OrganizerError("Invitation not found.");
  }

  if (invitation.status !== "PENDING") {
    throw new OrganizerError("Only pending invitations can be resent.");
  }

  const rows = await getPrisma().$queryRaw<OrganizationInvitationRow[]>`
    UPDATE "OrganizationInvitation"
    SET
      "token" = ${randomUUID()},
      "invitedById" = ${invitedById},
      "createdAt" = NOW()
    WHERE "id" = ${invitationId}
      AND "organizationId" = ${organizationId}
    RETURNING
      "id",
      "organizationId",
      "email",
      "role",
      "status",
      "invitedById",
      "token",
      "createdAt",
      "acceptedAt"
  `;

  return rows[0];
}

export async function getOrganizationInvitationByToken(token: string) {
  const rows = await getPrisma().$queryRaw<OrganizationInvitationDetail[]>`
    SELECT
      invitation."id",
      invitation."organizationId",
      invitation."email",
      invitation."role",
      invitation."status",
      invitation."invitedById",
      invitation."token",
      invitation."createdAt",
      invitation."acceptedAt",
      organization."name" AS "organizationName",
      organization."status" AS "organizationStatus",
      organization."slug" AS "organizationSlug",
      CONCAT("invitedBy"."firstName", ' ', "invitedBy"."lastName") AS "invitedByName"
    FROM "OrganizationInvitation" invitation
    INNER JOIN "Organization" organization ON organization."id" = invitation."organizationId"
    INNER JOIN "User" "invitedBy" ON "invitedBy"."id" = invitation."invitedById"
    WHERE invitation."token" = ${token}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function acceptOrganizationInvitation({ token, userId }: { token: string; userId: string }) {
  return getPrisma().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<OrganizationInvitationDetail[]>`
      SELECT
        invitation."id",
        invitation."organizationId",
        invitation."email",
        invitation."role",
        invitation."status",
        invitation."invitedById",
        invitation."token",
        invitation."createdAt",
        invitation."acceptedAt",
        organization."name" AS "organizationName",
        organization."status" AS "organizationStatus",
        organization."slug" AS "organizationSlug",
        CONCAT("invitedBy"."firstName", ' ', "invitedBy"."lastName") AS "invitedByName"
      FROM "OrganizationInvitation" invitation
      INNER JOIN "Organization" organization ON organization."id" = invitation."organizationId"
      INNER JOIN "User" "invitedBy" ON "invitedBy"."id" = invitation."invitedById"
      WHERE invitation."token" = ${token}
      FOR UPDATE OF invitation
      LIMIT 1
    `;
    const invitation = rows[0];

    if (!invitation) {
      throw new OrganizerError("Invitation not found.");
    }

    if (invitation.status !== "PENDING") {
      throw new OrganizerError("This invitation is no longer pending.");
    }

    if (invitation.organizationStatus !== "APPROVED") {
      throw new OrganizerError("This organization is not approved for organizer access.");
    }

    const user = await tx.user.findUnique({
      where: {
        id: userId
      },
      select: {
        email: true,
        role: true
      }
    });

    if (!user) {
      throw new OrganizerError("Sign in with the invited account to accept this invitation.");
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new OrganizerError(`This invitation is for ${invitation.email}. Sign in with that account to accept it.`);
    }

    await tx.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId: invitation.organizationId
        }
      },
      update: {
        role: invitation.role
      },
      create: {
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role
      }
    });

    if (user.role === "RUNNER") {
      await tx.user.update({
        where: {
          id: userId
        },
        data: {
          role: "ORGANIZER"
        }
      });
    }

    await tx.$executeRaw`
      UPDATE "OrganizationInvitation"
      SET
        "status" = 'ACCEPTED'::"InvitationStatus",
        "acceptedAt" = NOW()
      WHERE "id" = ${invitation.id}
    `;

    return invitation;
  });
}

export async function createOrganizerRace({
  organizationId,
  input
}: {
  organizationId: string;
  input: unknown;
}) {
  const parsed = organizerRaceSchema.safeParse(input);

  if (!parsed.success) {
    throw new OrganizerError("Check the required race fields and try again.");
  }

  const organization = await getPrisma().organization.findUniqueOrThrow({
    where: {
      id: organizationId
    },
    select: {
      name: true,
      slug: true
    }
  });
  const slug = await createUniqueRaceSlug(parsed.data.title);
  const categories = parsed.data.categories ?? [
    {
      name: parsed.data.categoryName,
      raceType: parsed.data.raceType,
      distanceKm: parsed.data.distanceKm,
      priceDzd: parsed.data.priceDzd,
      maxParticipants: parsed.data.categoryMaxParticipants,
      startTime: parsed.data.startTime
    }
  ];
  const inferredMaxParticipants = categories.every((category) => typeof category.maxParticipants === "number")
    ? categories.reduce((total, category) => total + (category.maxParticipants ?? 0), 0)
    : undefined;
  const maxParticipants = parsed.data.maxParticipants ?? inferredMaxParticipants;

  return getPrisma().$transaction(async (tx) => {
    const race = await tx.raceEvent.create({
      data: {
        organizationId,
        source: "ORGANIZATION",
        status: "PENDING_REVIEW",
        registrationStatus: "NOT_OPEN",
        title: parsed.data.title,
        slug,
        description: parsed.data.description,
        raceType: parsed.data.raceType,
        startDate: new Date(parsed.data.startDate),
        registrationCloseAt: parsed.data.registrationCloseAt ? new Date(parsed.data.registrationCloseAt) : undefined,
        wilaya: parsed.data.wilaya,
        city: parsed.data.city,
        commune: parsed.data.commune,
        address: parsed.data.address,
        organizerName: organization.name,
        organizerUrl: `/organizations/${organization.slug}`,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone,
        baridiMobNumber: parsed.data.baridiMobNumber,
        ccpAccount: parsed.data.ccpAccount,
        ccpKey: parsed.data.ccpKey,
        paymentNote: parsed.data.paymentNote,
        mainImageUrl: parsed.data.mainImageUrl,
        maxParticipants,
        availablePlaces: maxParticipants
      }
    });

    await setRaceAutoCancelUnpaidAfterHours(tx, race.id, parsed.data.autoCancelUnpaidAfterHours ?? null);
    await setRaceOptionalDetails(tx, race.id, {
      elevationGainText: parsed.data.elevationGainText ?? null,
      conditions: parsed.data.conditions ?? null
    });

    for (const category of categories) {
      const created = await tx.raceCategory.create({
        data: {
          raceEventId: race.id,
          name: category.name,
          distanceKm: category.distanceKm,
          priceDzd: category.priceDzd,
          maxParticipants: category.maxParticipants,
          startTime: category.startTime ? new Date(category.startTime) : undefined
        }
      });

      await tx.$executeRaw`
        UPDATE "RaceCategory"
        SET "raceType" = ${category.raceType}::"RaceType"
        WHERE "id" = ${created.id}
      `;
    }

    return race;
  });
}

export async function updateOrganizerRaceRegistrationStatus({
  organizationId,
  raceEventId,
  registrationStatus
}: {
  organizationId: string;
  raceEventId: string;
  registrationStatus: "OPEN" | "CLOSED" | "FULL" | "CANCELLED";
}) {
  const race = await getPrisma().raceEvent.findFirst({
    where: {
      id: raceEventId,
      organizationId
    },
    select: {
      id: true,
      status: true,
      startDate: true,
      registrationCloseAt: true,
      availablePlaces: true,
      maxParticipants: true,
      _count: {
        select: {
          categories: true
        }
      }
    }
  });

  if (!race) {
    throw new OrganizerError("Race not found for this organization.");
  }

  if (race.status !== "PUBLISHED") {
    throw new OrganizerError("Registration can only be opened or closed after admin publication.");
  }

  if (registrationStatus === "OPEN") {
    const now = new Date();

    if (race.startDate <= now) {
      throw new OrganizerError("Registration cannot be opened after the race start date.");
    }

    if (race.registrationCloseAt && race.registrationCloseAt <= now) {
      throw new OrganizerError("Registration cannot be opened after the registration deadline.");
    }

    if (race._count.categories === 0) {
      throw new OrganizerError("Add at least one race category before opening registration.");
    }

    if (race.availablePlaces != null && race.availablePlaces <= 0) {
      throw new OrganizerError("Registration cannot be opened because this race is full.");
    }

    if (race.maxParticipants != null) {
      const activeRegistrations = await getPrisma().raceRegistration.count({
        where: {
          raceEventId: race.id,
          status: {
            notIn: ["CANCELLED", "REJECTED"]
          }
        }
      });

      if (activeRegistrations >= race.maxParticipants) {
        throw new OrganizerError("Registration cannot be opened because the race capacity is already full.");
      }
    }
  }

  return getPrisma().raceEvent.update({
    where: {
      id: race.id
    },
    data: {
      registrationStatus
    }
  });
}

export async function updateOrganizerRace({
  organizationId,
  raceEventId,
  editorId,
  input
}: {
  organizationId: string;
  raceEventId: string;
  editorId: string;
  input: unknown;
}) {
  const parsed = organizerRaceUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new OrganizerError("Check the required race fields and try again.");
  }

  const race = await getEditableOrganizerRace(organizationId, raceEventId);

  return getPrisma().$transaction(async (tx) => {
    const current = await tx.raceEvent.findUniqueOrThrow({
      where: {
        id: race.id
      },
      select: {
        title: true,
        description: true,
        raceType: true,
        startDate: true,
        registrationCloseAt: true,
        wilaya: true,
        city: true,
        commune: true,
        address: true,
        contactEmail: true,
        contactPhone: true,
        baridiMobNumber: true,
        ccpAccount: true,
        ccpKey: true,
        paymentNote: true,
        maxParticipants: true,
        mainImageUrl: true
      }
    });
    const currentAutoCancelUnpaidAfterHours = await getRaceAutoCancelUnpaidAfterHours(race.id);
    const currentOptionalDetails = await getRaceOptionalDetails(tx, race.id);
    const updates = {
      title: parsed.data.title,
      description: parsed.data.description,
      raceType: parsed.data.raceType,
      startDate: new Date(parsed.data.startDate),
      registrationCloseAt: parsed.data.registrationCloseAt ? new Date(parsed.data.registrationCloseAt) : null,
      wilaya: parsed.data.wilaya,
      city: parsed.data.city,
      commune: parsed.data.commune ?? null,
      address: parsed.data.address ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      baridiMobNumber: parsed.data.baridiMobNumber ?? null,
      ccpAccount: parsed.data.ccpAccount ?? null,
      ccpKey: parsed.data.ccpKey ?? null,
      paymentNote: parsed.data.paymentNote ?? null,
      maxParticipants: parsed.data.maxParticipants ?? null,
      mainImageUrl: parsed.data.mainImageUrl ?? null
    };
    const autoCancelUnpaidAfterHours = parsed.data.autoCancelUnpaidAfterHours ?? null;
    const changes = buildChangeList(
      { ...current, ...currentOptionalDetails, autoCancelUnpaidAfterHours: currentAutoCancelUnpaidAfterHours },
      {
        ...updates,
        elevationGainText: parsed.data.elevationGainText ?? null,
        conditions: parsed.data.conditions ?? null,
        autoCancelUnpaidAfterHours
      }
    );

    const updated = await tx.raceEvent.update({
      where: {
        id: race.id
      },
      data: {
        ...updates,
        availablePlaces: parsed.data.maxParticipants ?? null
      }
    });

    await setRaceAutoCancelUnpaidAfterHours(tx, race.id, autoCancelUnpaidAfterHours);
    await setRaceOptionalDetails(tx, race.id, {
      elevationGainText: parsed.data.elevationGainText ?? null,
      conditions: parsed.data.conditions ?? null
    });

    if (changes.length > 0) {
      await recordRaceEditHistory(tx, {
        raceEventId: race.id,
        editorId,
        action: "race.updated",
        summary: "Race details updated",
        changes
      });
    }

    return updated;
  });
}

export async function upsertOrganizerRaceCategory({
  organizationId,
  raceEventId,
  editorId,
  input
}: {
  organizationId: string;
  raceEventId: string;
  editorId: string;
  input: unknown;
}) {
  const parsed = organizerCategorySchema.safeParse(input);

  if (!parsed.success) {
    throw new OrganizerError("Check the category fields and try again.");
  }

  const race = await getEditableOrganizerRace(organizationId, raceEventId);

  if (parsed.data.categoryId) {
    return getPrisma().$transaction(async (tx) => {
      const category = await tx.raceCategory.findFirst({
        where: {
          id: parsed.data.categoryId,
          raceEventId: race.id
        },
        select: {
          id: true,
          name: true,
          distanceKm: true,
          priceDzd: true,
          maxParticipants: true,
          startTime: true
        }
      });

      if (!category) {
        throw new OrganizerError("Category not found for this race.");
      }

      const currentRaceType = await getCategoryRaceType(category.id, tx);
      const updates = {
        name: parsed.data.name,
        distanceKm: parsed.data.distanceKm,
        priceDzd: parsed.data.priceDzd ?? null,
        maxParticipants: parsed.data.maxParticipants ?? null,
        startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : null
      };
      const changes = buildChangeList({ ...category, raceType: currentRaceType ?? race.raceType }, { ...updates, raceType: parsed.data.raceType });
      const updated = await tx.raceCategory.update({
        where: {
          id: category.id
        },
        data: updates
      });
      await tx.$executeRaw`
        UPDATE "RaceCategory"
        SET "raceType" = ${parsed.data.raceType}::"RaceType"
        WHERE "id" = ${category.id}
      `;

      if (changes.length > 0) {
        await recordRaceEditHistory(tx, {
          raceEventId: race.id,
          editorId,
          action: "category.updated",
          summary: `Category ${updated.name} updated`,
          changes: changes.map((change) => ({
            ...change,
            field: `category.${updated.id}.${change.field}`
          }))
        });
      }

      return updated;
    });
  }

  return getPrisma().$transaction(async (tx) => {
    const created = await tx.raceCategory.create({
      data: {
        raceEventId: race.id,
        name: parsed.data.name,
        distanceKm: parsed.data.distanceKm,
        priceDzd: parsed.data.priceDzd,
        maxParticipants: parsed.data.maxParticipants,
        startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : undefined
      }
    });
    await tx.$executeRaw`
      UPDATE "RaceCategory"
      SET "raceType" = ${parsed.data.raceType}::"RaceType"
      WHERE "id" = ${created.id}
    `;

    await recordRaceEditHistory(tx, {
      raceEventId: race.id,
      editorId,
      action: "category.created",
      summary: `Category ${created.name} created`,
      changes: [
        {
          field: `category.${created.id}`,
          before: null,
          after: {
            name: created.name,
            raceType: parsed.data.raceType,
            distanceKm: created.distanceKm,
            priceDzd: created.priceDzd,
            maxParticipants: created.maxParticipants,
            startTime: created.startTime
          }
        }
      ]
    });

    return created;
  });
}

async function getCategoryRaceTypes(categoryIds: string[]) {
  if (categoryIds.length === 0) {
    return new Map<string, string | null>();
  }

  const rows = await getPrisma().$queryRaw<Array<{ id: string; raceType: string | null }>>`
    SELECT "id", "raceType"
    FROM "RaceCategory"
    WHERE "id" = ANY(${categoryIds})
  `;

  return new Map(rows.map((row) => [row.id, row.raceType]));
}

async function getCategoryRaceType(categoryId: string, tx: Pick<ReturnType<typeof getPrisma>, "$queryRaw"> = getPrisma()) {
  const rows = await tx.$queryRaw<Array<{ raceType: string | null }>>`
    SELECT "raceType"
    FROM "RaceCategory"
    WHERE "id" = ${categoryId}
    LIMIT 1
  `;

  return rows[0]?.raceType ?? null;
}

export async function updateOrganizationMemberRole({
  organizationId,
  actorMemberId,
  actorRole,
  targetMemberId,
  role
}: {
  organizationId: string;
  actorMemberId: string;
  actorRole: "OWNER" | "ADMIN" | "MEMBER";
  targetMemberId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}) {
  return getPrisma().$transaction(async (tx) => {
    const target = await tx.organizationMember.findFirst({
      where: {
        id: targetMemberId,
        organizationId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!target) {
      throw new OrganizerError("Organization member not found.");
    }

    assertCanManageMember({
      actorMemberId,
      actorRole,
      targetMemberId: target.id,
      targetRole: target.role,
      nextRole: role
    });

    if (target.role === "OWNER" && role !== "OWNER") {
      await assertOrganizationKeepsOwner(tx, organizationId);
    }

    return tx.organizationMember.update({
      where: {
        id: target.id
      },
      data: {
        role
      }
    });
  });
}

export async function removeOrganizationMember({
  organizationId,
  actorMemberId,
  actorRole,
  targetMemberId
}: {
  organizationId: string;
  actorMemberId: string;
  actorRole: "OWNER" | "ADMIN" | "MEMBER";
  targetMemberId: string;
}) {
  return getPrisma().$transaction(async (tx) => {
    const target = await tx.organizationMember.findFirst({
      where: {
        id: targetMemberId,
        organizationId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!target) {
      throw new OrganizerError("Organization member not found.");
    }

    assertCanManageMember({
      actorMemberId,
      actorRole,
      targetMemberId: target.id,
      targetRole: target.role
    });

    if (target.role === "OWNER") {
      await assertOrganizationKeepsOwner(tx, organizationId);
    }

    return tx.organizationMember.delete({
      where: {
        id: target.id
      }
    });
  });
}

async function getEditableOrganizerRace(organizationId: string, raceEventId: string) {
  const race = await getPrisma().raceEvent.findFirst({
    where: {
      id: raceEventId,
      organizationId
    },
    select: {
      id: true,
      raceType: true,
      status: true
    }
  });

  if (!race) {
    throw new OrganizerError("Race not found for this organization.");
  }

  if (race.status !== "DRAFT" && race.status !== "PENDING_REVIEW" && race.status !== "REJECTED") {
    throw new OrganizerError("Only draft, pending, or rejected races can be edited by organizers.");
  }

  return race;
}

type ChangeRecord = {
  field: string;
  before: unknown;
  after: unknown;
};

function buildChangeList(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.entries(after).reduce<ChangeRecord[]>((changes, [field, nextValue]) => {
    const previousValue = before[field];

    if (normalizeHistoryValue(previousValue) !== normalizeHistoryValue(nextValue)) {
      changes.push({
        field,
        before: serializeHistoryValue(previousValue),
        after: serializeHistoryValue(nextValue)
      });
    }

    return changes;
  }, []);
}

async function recordRaceEditHistory(
  client: Pick<ReturnType<typeof getPrisma>, "$executeRaw">,
  input: {
    raceEventId: string;
    editorId: string;
    action: string;
    summary: string;
    changes: ChangeRecord[];
  }
) {
  await client.$executeRaw`
    INSERT INTO "RaceEditHistory" (
      "id",
      "raceEventId",
      "editorId",
      "action",
      "summary",
      "changes",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.raceEventId},
      ${input.editorId},
      ${input.action},
      ${input.summary},
      CAST(${JSON.stringify(input.changes)} AS jsonb),
      NOW()
    )
  `;
}

function normalizeHistoryValue(value: unknown) {
  return JSON.stringify(serializeHistoryValue(value));
}

function serializeHistoryValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeHistoryValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeHistoryValue(nestedValue)])
    );
  }

  return value ?? null;
}

function assertCanManageMember({
  actorMemberId,
  actorRole,
  targetMemberId,
  targetRole,
  nextRole
}: {
  actorMemberId: string;
  actorRole: "OWNER" | "ADMIN" | "MEMBER";
  targetMemberId: string;
  targetRole: "OWNER" | "ADMIN" | "MEMBER";
  nextRole?: "OWNER" | "ADMIN" | "MEMBER";
}) {
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") {
    throw new OrganizerError("Only organization owners and admins can manage members.");
  }

  if (actorMemberId === targetMemberId) {
    throw new OrganizerError("You cannot change or remove your own organization access.");
  }

  if (targetRole === "OWNER" && actorRole !== "OWNER") {
    throw new OrganizerError("Only an owner can manage another owner.");
  }

  if (nextRole === "OWNER" && actorRole !== "OWNER") {
    throw new OrganizerError("Only an owner can assign owner access.");
  }
}

async function assertOrganizationKeepsOwner(
  tx: Pick<ReturnType<typeof getPrisma>, "organizationMember">,
  organizationId: string
) {
  const ownerCount = await tx.organizationMember.count({
    where: {
      organizationId,
      role: "OWNER"
    }
  });

  if (ownerCount <= 1) {
    throw new OrganizerError("Every organization must keep at least one owner.");
  }
}

function isRegistrationStatus(value?: string) {
  return value === "PENDING" || value === "CONFIRMED" || value === "CANCELLED" || value === "REJECTED" || value === "WAITING_LIST";
}

function applyPaymentStateFilter(where: Prisma.RaceRegistrationWhereInput, paymentState?: string) {
  if (paymentState === "CONFIRMED") {
    where.paymentStatus = {
      in: ["PAID", "NOT_REQUIRED"]
    };
    return;
  }

  if (paymentState === "NOT_CONFIRMED") {
    where.paymentStatus = {
      notIn: ["PAID", "NOT_REQUIRED"]
    };
  }
}

async function countOrganizationInvitations(organizationId: string) {
  const rows = await getPrisma().$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM "OrganizationInvitation"
    WHERE "organizationId" = ${organizationId}
  `;

  return rows[0]?.count ?? 0;
}

async function getOrganizationInvitations(organizationId: string) {
  return getPrisma().$queryRaw<OrganizationInvitationRow[]>`
    SELECT
      "id",
      "organizationId",
      "email",
      "role",
      "status",
      "invitedById",
      "token",
      "createdAt",
      "acceptedAt"
    FROM "OrganizationInvitation"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "createdAt" DESC
  `;
}

async function getOrganizationInvitationForManagement({
  organizationId,
  invitationId
}: {
  organizationId: string;
  invitationId: string;
}) {
  const rows = await getPrisma().$queryRaw<OrganizationInvitationRow[]>`
    SELECT
      "id",
      "organizationId",
      "email",
      "role",
      "status",
      "invitedById",
      "token",
      "createdAt",
      "acceptedAt"
    FROM "OrganizationInvitation"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${invitationId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function upsertOrganizationInvitation({
  organizationId,
  email,
  role,
  invitedById
}: {
  organizationId: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  invitedById: string;
}) {
  const rows = await getPrisma().$queryRaw<OrganizationInvitationRow[]>`
    INSERT INTO "OrganizationInvitation" (
      "id",
      "organizationId",
      "email",
      "role",
      "status",
      "invitedById",
      "token",
      "createdAt",
      "acceptedAt"
    )
    VALUES (
      ${randomUUID()},
      ${organizationId},
      ${email},
      ${role}::"OrganizerRole",
      'PENDING'::"InvitationStatus",
      ${invitedById},
      ${randomUUID()},
      NOW(),
      NULL
    )
    ON CONFLICT ("organizationId", "email")
    DO UPDATE SET
      "role" = EXCLUDED."role",
      "status" = 'PENDING'::"InvitationStatus",
      "invitedById" = EXCLUDED."invitedById",
      "token" = EXCLUDED."token",
      "acceptedAt" = NULL
    RETURNING
      "id",
      "organizationId",
      "email",
      "role",
      "status",
      "invitedById",
      "token",
      "createdAt",
      "acceptedAt"
  `;

  return rows[0];
}
