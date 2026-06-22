import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { notifyRaceRegistrantsRaceChanged } from "@/lib/notifications";
import { buildPaginationMeta, parsePagination, type PaginatedResult, type PaginationParams } from "@/lib/pagination";
import { createUniqueRaceSlug } from "@/lib/race-slugs";
import { getRaceOptionalDetails, setRaceOptionalDetails } from "@/lib/race-optional-details";
import {
  cancelExpiredUnpaidRegistrations,
  getRaceAutoCancelUnpaidAfterHours,
  setRaceAutoCancelUnpaidAfterHours
} from "@/lib/registration-auto-cancel";
import { adminRaceUpdateSchema, platformRaceSchema } from "@/lib/validations";

export const ADMIN_AUDIT_RETENTION_DAYS = 31;

type AdminUserRow = Prisma.UserGetPayload<{
  include: {
    _count: {
      select: {
        registrations: true;
        organizations: true;
      };
    };
  };
}>;

type AdminOrganizationRow = Prisma.OrganizationGetPayload<{
  include: {
    members: {
      include: {
        user: {
          select: {
            firstName: true;
            lastName: true;
            email: true;
          };
        };
      };
    };
    _count: {
      select: {
        members: true;
        races: true;
      };
    };
  };
}> & {
  rejectionReason: string | null;
  logoUrl: string | null;
};

type AdminRaceRow = Prisma.RaceEventGetPayload<{
  include: {
    organization: {
      select: {
        name: true;
        slug: true;
      };
    };
    categories: {
      select: {
        priceDzd: true;
      };
    };
    _count: {
      select: {
        categories: true;
        registrations: true;
      };
    };
  };
}>;

type AdminRegistrationRow = Prisma.RaceRegistrationGetPayload<{
  include: {
    user: {
      select: {
        firstName: true;
        lastName: true;
        email: true;
        phone: true;
      };
    };
    raceEvent: {
      select: {
        title: true;
        slug: true;
        startDate: true;
        wilaya: true;
        city: true;
      };
    };
    raceCategory: {
      select: {
        name: true;
        distanceKm: true;
        priceDzd: true;
      };
    };
  };
}>;

export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

export async function requireAdmin() {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    redirect("/account");
  }

  return session;
}

export async function getAdminDashboardStats() {
  const prisma = getPrisma();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const day = startOfWeek.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalUsers,
    totalOrganizations,
    totalRaces,
    racesCreatedToday,
    racesCreatedThisWeek,
    racesCreatedThisYear,
    allTimeRegistrations,
    pendingOrganizations,
    pendingRaces,
    manualReviewPayments
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.raceEvent.count(),
    prisma.raceEvent.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.raceEvent.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.raceEvent.count({ where: { createdAt: { gte: startOfYear } } }),
    prisma.raceRegistration.count(),
    prisma.organization.count({ where: { status: "PENDING" } }),
    prisma.raceEvent.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.raceRegistration.count({ where: { paymentStatus: "MANUAL_REVIEW" } })
  ]);

  return {
    totalUsers,
    totalOrganizations,
    totalRaces,
    racesCreatedToday,
    racesCreatedThisWeek,
    racesCreatedThisYear,
    allTimeRegistrations,
    pendingOrganizations,
    pendingRaces,
    manualReviewPayments
  };
}

export async function createPlatformRace(input: unknown) {
  const parsed = platformRaceSchema.safeParse(input);

  if (!parsed.success) {
    throw new AdminError("Check the required platform race fields and try again.");
  }

  const now = new Date();
  const startDate = new Date(parsed.data.startDate);
  const registrationCloseAt = parsed.data.registrationCloseAt ? new Date(parsed.data.registrationCloseAt) : undefined;

  if (Number.isNaN(startDate.getTime())) {
    throw new AdminError("Use a valid race start date.");
  }

  if (registrationCloseAt && Number.isNaN(registrationCloseAt.getTime())) {
    throw new AdminError("Use a valid registration deadline.");
  }

  if (parsed.data.registrationStatus === "OPEN") {
    if (startDate <= now) {
      throw new AdminError("Registration cannot be opened after the race start date.");
    }

    if (registrationCloseAt && registrationCloseAt <= now) {
      throw new AdminError("Registration cannot be opened after the registration deadline.");
    }
  }

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
        source: "PLATFORM",
        status: "PUBLISHED",
        registrationStatus: parsed.data.registrationStatus,
        title: parsed.data.title,
        slug,
        description: parsed.data.description,
        raceType: parsed.data.raceType,
        startDate,
        registrationCloseAt,
        wilaya: parsed.data.wilaya,
        city: parsed.data.city,
        commune: parsed.data.commune,
        address: parsed.data.address,
        organizerName: parsed.data.organizerName,
        organizerUrl: parsed.data.organizerUrl,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone,
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

export type AdminRaceForEdit = {
  id: string;
  title: string;
  description: string;
  elevationGainText: string | null;
  conditions: string | null;
  raceType: string;
  status: string;
  registrationStatus: string;
  startDate: Date;
  registrationCloseAt: Date | null;
  wilaya: string;
  city: string;
  commune: string | null;
  address: string | null;
  organizerName: string | null;
  organizerUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  maxParticipants: number | null;
  autoCancelUnpaidAfterHours: number | null;
  mainImageUrl: string | null;
  slug: string;
};

export async function getAdminRaceForEdit(raceEventId: string) {
  const race = await getPrisma().raceEvent.findUnique({
    where: {
      id: raceEventId
    },
    select: {
      id: true,
      title: true,
      description: true,
      raceType: true,
      status: true,
      registrationStatus: true,
      startDate: true,
      registrationCloseAt: true,
      wilaya: true,
      city: true,
      commune: true,
      address: true,
      organizerName: true,
      organizerUrl: true,
      contactEmail: true,
      contactPhone: true,
      maxParticipants: true,
      mainImageUrl: true,
      slug: true
    }
  });

  if (!race) {
    return null;
  }

  return {
    ...race,
    ...(await getRaceOptionalDetails(getPrisma(), race.id)),
    autoCancelUnpaidAfterHours: await getRaceAutoCancelUnpaidAfterHours(race.id)
  };
}

export async function updateAdminRace({
  actorId,
  raceEventId,
  input
}: {
  actorId: string;
  raceEventId: string;
  input: unknown;
}) {
  const parsed = adminRaceUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new AdminError("Check the race fields and try again.");
  }

  const current = await getAdminRaceForEdit(raceEventId);

  if (!current) {
    throw new AdminError("Race not found.");
  }

  const updates = {
    title: parsed.data.title,
    description: parsed.data.description,
    raceType: parsed.data.raceType,
    status: parsed.data.status,
    registrationStatus: parsed.data.registrationStatus,
    startDate: new Date(parsed.data.startDate),
    registrationCloseAt: parsed.data.registrationCloseAt ? new Date(parsed.data.registrationCloseAt) : null,
    wilaya: parsed.data.wilaya,
    city: parsed.data.city,
    commune: parsed.data.commune ?? null,
    address: parsed.data.address ?? null,
    organizerName: parsed.data.organizerName ?? null,
    organizerUrl: parsed.data.organizerUrl ?? null,
    contactEmail: parsed.data.contactEmail ?? null,
    contactPhone: parsed.data.contactPhone ?? null,
    maxParticipants: parsed.data.maxParticipants ?? null,
    mainImageUrl: parsed.data.mainImageUrl ?? null
  };
  const autoCancelUnpaidAfterHours = parsed.data.autoCancelUnpaidAfterHours ?? null;

  const changes = buildChangeList(current, {
    ...updates,
    elevationGainText: parsed.data.elevationGainText ?? null,
    conditions: parsed.data.conditions ?? null,
    autoCancelUnpaidAfterHours
  });

  const updated = await getPrisma().$transaction(async (tx) => {
    const race = await tx.raceEvent.update({
      where: {
        id: raceEventId
      },
      data: {
        ...updates,
        availablePlaces: parsed.data.maxParticipants ?? null
      }
    });

    await setRaceAutoCancelUnpaidAfterHours(tx, raceEventId, autoCancelUnpaidAfterHours);
    await setRaceOptionalDetails(tx, raceEventId, {
      elevationGainText: parsed.data.elevationGainText ?? null,
      conditions: parsed.data.conditions ?? null
    });

    return race;
  });

  if (changes.length > 0) {
    await recordAdminAuditLog({
      actorId,
      action: "race.updated",
      targetType: "RaceEvent",
      targetId: raceEventId,
      summary: `Updated race ${updated.title}`,
      metadata: {
        changes
      }
    });

    await notifyRaceRegistrantsRaceChanged({
      raceId: updated.id,
      raceSlug: updated.slug,
      raceTitle: updated.title,
      summary: `"${updated.title}" has updated race details. Review the latest date, location, registration status, and race information before race day.`,
      changes: changes.map((change) => formatChangeField(change.field))
    });
  }

  return updated;
}

export type AdminAuditLogRow = {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string | null;
  metadata: unknown;
  createdAt: Date;
};

export async function getAdminAuditLogs(
  filters: {
    actor?: string;
    targetType?: string;
    action?: string;
  } = {},
  pagination?: PaginationParams
): Promise<PaginatedResult<AdminAuditLogRow>> {
  const { page, limit, skip } = pagination ?? parsePagination();
  const prisma = getPrisma();
  const actor = filters.actor?.trim() ?? "";
  const actorLike = `%${actor}%`;
  const targetType = filters.targetType?.trim() ?? "";
  const action = filters.action?.trim() ?? "";

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<AdminAuditLogRow[]>`
      SELECT
        audit."id",
        audit."actorId",
        CONCAT(actor."firstName", ' ', actor."lastName") AS "actorName",
        actor."email" AS "actorEmail",
        audit."action",
        audit."targetType",
        audit."targetId",
        audit."summary",
        audit."metadata",
        audit."createdAt"
      FROM "AdminAuditLog" audit
      INNER JOIN "User" actor ON actor."id" = audit."actorId"
      WHERE (${actor} = '' OR actor."email" ILIKE ${actorLike} OR CONCAT(actor."firstName", ' ', actor."lastName") ILIKE ${actorLike})
        AND (${targetType} = '' OR audit."targetType" = ${targetType})
        AND (${action} = '' OR audit."action" = ${action})
      ORDER BY audit."createdAt" DESC
      LIMIT ${limit} OFFSET ${skip}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM "AdminAuditLog" audit
      INNER JOIN "User" actor ON actor."id" = audit."actorId"
      WHERE (${actor} = '' OR actor."email" ILIKE ${actorLike} OR CONCAT(actor."firstName", ' ', actor."lastName") ILIKE ${actorLike})
        AND (${targetType} = '' OR audit."targetType" = ${targetType})
        AND (${action} = '' OR audit."action" = ${action})
    `
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    items: rows,
    ...buildPaginationMeta(total, page, limit)
  };
}

export async function recordAdminAuditLog({
  actorId,
  action,
  targetType,
  targetId,
  summary,
  metadata
}: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary?: string;
  metadata?: unknown;
}) {
  await getPrisma().$executeRaw`
    INSERT INTO "AdminAuditLog" (
      "id",
      "actorId",
      "action",
      "targetType",
      "targetId",
      "summary",
      "metadata"
    )
    VALUES (
      ${randomUUID()},
      ${actorId},
      ${action},
      ${targetType},
      ${targetId},
      ${summary ?? null},
      ${metadata ? JSON.stringify(metadata) : null}::jsonb
    )
  `;
}

export function getAdminAuditRetentionCutoff({
  retentionDays = ADMIN_AUDIT_RETENTION_DAYS,
  now = new Date()
}: {
  retentionDays?: number;
  now?: Date;
} = {}) {
  const safeRetentionDays = Math.max(1, Math.floor(retentionDays));

  return new Date(now.getTime() - safeRetentionDays * 24 * 60 * 60 * 1000);
}

export async function pruneExpiredAdminAuditLogs({
  retentionDays = ADMIN_AUDIT_RETENTION_DAYS,
  now = new Date()
}: {
  retentionDays?: number;
  now?: Date;
} = {}) {
  const cutoff = getAdminAuditRetentionCutoff({ retentionDays, now });
  const result = await getPrisma().adminAuditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoff
      }
    }
  });

  return {
    deleted: result.count,
    cutoff,
    retentionDays: Math.max(1, Math.floor(retentionDays))
  };
}

export async function getAdminUsers(
  filters: { q?: string; role?: string },
  pagination?: PaginationParams
): Promise<PaginatedResult<AdminUserRow>> {
  const prisma = getPrisma();
  const q = filters.q?.trim();
  const { page, limit, skip } = pagination ?? parsePagination();

  const where: Prisma.UserWhereInput = {
    role: isUserRole(filters.role) ? filters.role : undefined,
    OR: q
      ? [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { wilaya: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } }
        ]
      : undefined
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            registrations: true,
            organizations: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: limit
    }),
    prisma.user.count({ where })
  ]);

  return {
    items: users,
    ...buildPaginationMeta(total, page, limit)
  };
}

export async function getAdminUserById(userId: string) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      registrations: {
        orderBy: { createdAt: "desc" },
        include: {
          raceEvent: {
            select: {
              id: true,
              title: true,
              slug: true,
              startDate: true,
              wilaya: true,
              city: true,
              status: true,
              registrationStatus: true
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
        }
      },
      organizations: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true
            }
          }
        }
      },
      _count: {
        select: {
          registrations: true,
          organizations: true
        }
      }
    }
  });

  return user;
}

export async function getAdminOrganizations(
  filters: { q?: string; status?: string },
  pagination?: PaginationParams
): Promise<PaginatedResult<AdminOrganizationRow>> {
  const prisma = getPrisma();
  const q = filters.q?.trim();
  const { page, limit, skip } = pagination ?? parsePagination();

  const where: Prisma.OrganizationWhereInput = {
    status: isOrganizationStatus(filters.status) ? filters.status : undefined,
    OR: q
      ? [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { wilaya: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } }
        ]
      : undefined
  };

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        members: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          },
          take: 1
        },
        _count: {
          select: {
            members: true,
            races: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: limit
    }),
    prisma.organization.count({ where })
  ]);

  const organizationMeta = await getOrganizationAdminMeta(organizations.map((organization) => organization.id));

  const items = organizations.map((organization) => ({
    ...organization,
    rejectionReason: organizationMeta.get(organization.id)?.rejectionReason ?? null,
    logoUrl: organizationMeta.get(organization.id)?.logoUrl ?? null
  }));

  return {
    items,
    ...buildPaginationMeta(total, page, limit)
  };
}

export async function getAdminRaces(
  filters: {
    q?: string;
    status?: string;
    registrationStatus?: string;
    source?: string;
  },
  pagination?: PaginationParams
): Promise<PaginatedResult<AdminRaceRow>> {
  const prisma = getPrisma();
  const q = filters.q?.trim();
  const { page, limit, skip } = pagination ?? parsePagination();

  const where: Prisma.RaceEventWhereInput = {
    status: isRaceStatus(filters.status) ? filters.status : undefined,
    registrationStatus: isEventRegistrationStatus(filters.registrationStatus) ? filters.registrationStatus : undefined,
    source: filters.source === "ORGANIZATION" || filters.source === "PLATFORM" ? filters.source : undefined,
    OR: q
      ? [
          { title: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { wilaya: { contains: q, mode: "insensitive" } },
          { organizerName: { contains: q, mode: "insensitive" } },
          { organization: { name: { contains: q, mode: "insensitive" } } }
        ]
      : undefined
  };

  const [races, total] = await Promise.all([
    prisma.raceEvent.findMany({
      where,
      include: {
        organization: {
          select: {
            name: true,
            slug: true
          }
        },
        categories: {
          select: {
            priceDzd: true
          }
        },
        _count: {
          select: {
            categories: true,
            registrations: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip,
      take: limit
    }),
    prisma.raceEvent.count({ where })
  ]);

  return {
    items: races,
    ...buildPaginationMeta(total, page, limit)
  };
}

export async function getAdminRegistrations(
  filters: { q?: string; status?: string; paymentStatus?: string; paymentState?: string },
  pagination?: PaginationParams
): Promise<PaginatedResult<AdminRegistrationRow>> {
  const prisma = getPrisma();
  const q = filters.q?.trim();
  const { page, limit, skip } = pagination ?? parsePagination();

  await cancelExpiredUnpaidRegistrations();

  const where: Prisma.RaceRegistrationWhereInput = {
    status: isRegistrationStatus(filters.status) ? filters.status : undefined,
    OR: q
      ? [
          { user: { email: { contains: q, mode: "insensitive" } } },
          { user: { firstName: { contains: q, mode: "insensitive" } } },
          { user: { lastName: { contains: q, mode: "insensitive" } } },
          { raceEvent: { title: { contains: q, mode: "insensitive" } } },
          { raceCategory: { name: { contains: q, mode: "insensitive" } } }
        ]
      : undefined
  };

  applyPaymentFilter(where, filters);

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
        raceEvent: {
          select: {
            title: true,
            slug: true,
            startDate: true,
            wilaya: true,
            city: true
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

export async function confirmAdminRegistrationPayment({
  actorId,
  registrationId
}: {
  actorId: string;
  registrationId: string;
}) {
  const registration = await getPrisma().raceRegistration.findUnique({
    where: {
      id: registrationId
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      raceEvent: {
        select: {
          title: true
        }
      },
      user: {
        select: {
          email: true
        }
      }
    }
  });

  if (!registration) {
    throw new AdminError("Registration not found.");
  }

  if (registration.status === "CANCELLED" || registration.status === "REJECTED") {
    throw new AdminError("Payment cannot be confirmed for a cancelled or rejected registration.");
  }

  await getPrisma().raceRegistration.update({
    where: {
      id: registration.id
    },
    data: {
      paymentStatus: "PAID"
    }
  });

  await recordAdminAuditLog({
    actorId,
    action: "registration.payment_confirmed",
    targetType: "RaceRegistration",
    targetId: registration.id,
    summary: `Confirmed payment for ${registration.user.email} on ${registration.raceEvent.title}`,
    metadata: {
      previousPaymentStatus: registration.paymentStatus,
      nextPaymentStatus: "PAID"
    }
  });
}

export async function cancelAdminRaceRegistration({
  actorId,
  registrationId
}: {
  actorId: string;
  registrationId: string;
}) {
  const prisma = getPrisma();

  const registration = await prisma.$transaction(async (tx) => {
    const existing = await tx.raceRegistration.findUnique({
      where: {
        id: registrationId
      },
      select: {
        id: true,
        status: true,
        raceEventId: true,
        raceEvent: {
          select: {
            title: true,
            availablePlaces: true
          }
        },
        user: {
          select: {
            email: true
          }
        }
      }
    });

    if (!existing) {
      throw new AdminError("Registration not found.");
    }

    if (existing.status === "CANCELLED") {
      return existing;
    }

    await tx.raceRegistration.update({
      where: {
        id: existing.id
      },
      data: {
        status: "CANCELLED"
      }
    });

    if (existing.status !== "REJECTED" && existing.raceEvent.availablePlaces != null) {
      await tx.raceEvent.update({
        where: {
          id: existing.raceEventId
        },
        data: {
          availablePlaces: {
            increment: 1
          }
        }
      });
    }

    return existing;
  });

  await recordAdminAuditLog({
    actorId,
    action: "registration.cancelled",
    targetType: "RaceRegistration",
    targetId: registration.id,
    summary: `Cancelled registration for ${registration.user.email} on ${registration.raceEvent.title}`,
    metadata: {
      previousStatus: registration.status,
      nextStatus: "CANCELLED"
    }
  });
}

export type RaceEditHistoryRow = {
  id: string;
  raceEventId: string;
  raceTitle: string;
  editorId: string;
  editorName: string;
  editorEmail: string;
  action: string;
  summary: string | null;
  changes: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  createdAt: Date;
};

export async function getAdminRaceEditHistory(raceEventId: string) {
  return getPrisma().$queryRaw<RaceEditHistoryRow[]>`
    SELECT
      history."id",
      history."raceEventId",
      race."title" AS "raceTitle",
      history."editorId",
      CONCAT(editor."firstName", ' ', editor."lastName") AS "editorName",
      editor."email" AS "editorEmail",
      history."action",
      history."summary",
      history."changes",
      history."createdAt"
    FROM "RaceEditHistory" history
    INNER JOIN "RaceEvent" race ON race."id" = history."raceEventId"
    INNER JOIN "User" editor ON editor."id" = history."editorId"
    WHERE history."raceEventId" = ${raceEventId}
    ORDER BY history."createdAt" DESC
  `;
}

function isUserRole(value?: string) {
  return value === "RUNNER" || value === "ORGANIZER" || value === "ADMIN" || value === "SUPERADMIN";
}

function isOrganizationStatus(value?: string) {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "SUSPENDED";
}

function isRaceStatus(value?: string) {
  return value === "DRAFT" || value === "PENDING_REVIEW" || value === "PUBLISHED" || value === "CANCELLED" || value === "COMPLETED" || value === "REJECTED";
}

function isEventRegistrationStatus(value?: string) {
  return value === "NOT_OPEN" || value === "OPEN" || value === "CLOSED" || value === "FULL" || value === "CANCELLED";
}

function isRegistrationStatus(value?: string) {
  return value === "PENDING" || value === "CONFIRMED" || value === "CANCELLED" || value === "REJECTED" || value === "WAITING_LIST";
}

function isPaymentStatus(value?: string) {
  return value === "NOT_REQUIRED" || value === "PENDING" || value === "PAID" || value === "FAILED" || value === "REFUNDED" || value === "MANUAL_REVIEW";
}

function applyPaymentFilter(
  where: Prisma.RaceRegistrationWhereInput,
  filters: { paymentStatus?: string; paymentState?: string }
) {
  if (isPaymentStatus(filters.paymentStatus)) {
    where.paymentStatus = filters.paymentStatus;
    return;
  }

  if (filters.paymentState === "CONFIRMED") {
    where.paymentStatus = {
      in: ["PAID", "NOT_REQUIRED"]
    };
    return;
  }

  if (filters.paymentState === "NOT_CONFIRMED") {
    where.paymentStatus = {
      notIn: ["PAID", "NOT_REQUIRED"]
    };
  }
}

async function getOrganizationAdminMeta(organizationIds: string[]) {
  if (organizationIds.length === 0) {
    return new Map<string, { rejectionReason: string | null; logoUrl: string | null }>();
  }

  const rows = await getPrisma().$queryRaw<Array<{ id: string; rejectionReason: string | null; logoUrl: string | null }>>`
    SELECT "id", "rejectionReason", "logoUrl"
    FROM "Organization"
    WHERE "id" = ANY(${organizationIds})
  `;

  return new Map(rows.map((row) => [row.id, { rejectionReason: row.rejectionReason, logoUrl: row.logoUrl }]));
}

function buildChangeList(previous: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.entries(next).flatMap(([field, nextValue]) => {
    const previousValue = previous[field];

    if (normalizeHistoryValue(previousValue) === normalizeHistoryValue(nextValue)) {
      return [];
    }

    return [
      {
        field,
        before: serializeHistoryValue(previousValue),
        after: serializeHistoryValue(nextValue)
      }
    ];
  });
}

function formatChangeField(field: string) {
  const labels: Record<string, string> = {
    title: "Title",
    description: "Description",
    raceType: "Race type",
    status: "Publication status",
    registrationStatus: "Registration status",
    startDate: "Start date",
    registrationCloseAt: "Registration deadline",
    wilaya: "Wilaya",
    city: "City",
    commune: "Commune",
    address: "Address",
    organizerName: "Organizer",
    organizerUrl: "Organizer link",
    contactEmail: "Contact email",
    contactPhone: "Contact phone",
    maxParticipants: "Capacity",
    mainImageUrl: "Race image"
  };

  return labels[field] ?? field;
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
