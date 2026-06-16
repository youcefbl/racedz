import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { organizationInviteSchema, organizerRaceSchema } from "@/lib/validations";

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
  return getPrisma().raceEvent.findFirst({
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
          registrations: true
        }
      }
    }
  });
}

export async function getOrganizerRaceRegistrations(organizationId: string, raceEventId: string) {
  return getPrisma().raceRegistration.findMany({
    where: {
      raceEventId,
      raceEvent: {
        organizationId
      }
    },
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
      }
    },
    orderBy: {
      createdAt: "desc"
    }
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
  const maxParticipants = parsed.data.maxParticipants ?? parsed.data.categoryMaxParticipants;

  return getPrisma().raceEvent.create({
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
      maxParticipants,
      availablePlaces: maxParticipants,
      categories: {
        create: {
          name: parsed.data.categoryName,
          distanceKm: parsed.data.distanceKm,
          priceDzd: parsed.data.priceDzd,
          maxParticipants: parsed.data.categoryMaxParticipants
        }
      }
    }
  });
}

export async function updateOrganizerRaceRegistrationStatus({
  organizationId,
  raceEventId,
  registrationStatus
}: {
  organizationId: string;
  raceEventId: string;
  registrationStatus: "OPEN" | "CLOSED";
}) {
  const race = await getPrisma().raceEvent.findFirst({
    where: {
      id: raceEventId,
      organizationId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!race) {
    throw new OrganizerError("Race not found for this organization.");
  }

  if (race.status !== "PUBLISHED") {
    throw new OrganizerError("Registration can only be opened or closed after admin publication.");
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

async function createUniqueRaceSlug(title: string) {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 2;

  while (await getPrisma().raceEvent.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
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

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "race";
}
