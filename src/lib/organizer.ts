import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import {
  organizationInviteSchema,
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
        maxParticipants: true,
        mainImageUrl: true
      }
    });
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
      maxParticipants: parsed.data.maxParticipants ?? null,
      mainImageUrl: parsed.data.mainImageUrl ?? null
    };
    const changes = buildChangeList(current, updates);

    const updated = await tx.raceEvent.update({
      where: {
        id: race.id
      },
      data: {
        ...updates,
        availablePlaces: parsed.data.maxParticipants ?? null
      }
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

      const updates = {
        name: parsed.data.name,
        distanceKm: parsed.data.distanceKm,
        priceDzd: parsed.data.priceDzd ?? null,
        maxParticipants: parsed.data.maxParticipants ?? null,
        startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : null
      };
      const changes = buildChangeList(category, updates);
      const updated = await tx.raceCategory.update({
        where: {
          id: category.id
        },
        data: updates
      });

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

async function getEditableOrganizerRace(organizationId: string, raceEventId: string) {
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
