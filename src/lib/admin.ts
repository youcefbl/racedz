import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { createUniqueRaceSlug } from "@/lib/race-slugs";
import { adminRaceUpdateSchema, platformRaceSchema } from "@/lib/validations";

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

  return race;
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

  const changes = buildChangeList(current, updates);

  const updated = await getPrisma().raceEvent.update({
    where: {
      id: raceEventId
    },
    data: {
      ...updates,
      availablePlaces: parsed.data.maxParticipants ?? null
    }
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

export async function getAdminAuditLogs() {
  return getPrisma().$queryRaw<AdminAuditLogRow[]>`
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
    ORDER BY audit."createdAt" DESC
    LIMIT 100
  `;
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

export async function getAdminUsers(filters: { q?: string; role?: string }) {
  const prisma = getPrisma();
  const q = filters.q?.trim();

  return prisma.user.findMany({
    where: {
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
    },
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
    take: 50
  });
}

export async function getAdminOrganizations(filters: { q?: string; status?: string }) {
  const prisma = getPrisma();
  const q = filters.q?.trim();

  const organizations = await prisma.organization.findMany({
    where: {
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
    },
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
    take: 50
  });
  const organizationMeta = await getOrganizationAdminMeta(organizations.map((organization) => organization.id));

  return organizations.map((organization) => ({
    ...organization,
    rejectionReason: organizationMeta.get(organization.id)?.rejectionReason ?? null,
    logoUrl: organizationMeta.get(organization.id)?.logoUrl ?? null
  }));
}

export async function getAdminRaces(filters: {
  q?: string;
  status?: string;
  registrationStatus?: string;
  source?: string;
}) {
  const prisma = getPrisma();
  const q = filters.q?.trim();

  return prisma.raceEvent.findMany({
    where: {
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
    },
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
    take: 50
  });
}

export async function getAdminRegistrations(filters: { q?: string; status?: string; paymentStatus?: string }) {
  const prisma = getPrisma();
  const q = filters.q?.trim();

  return prisma.raceRegistration.findMany({
    where: {
      status: isRegistrationStatus(filters.status) ? filters.status : undefined,
      paymentStatus: isPaymentStatus(filters.paymentStatus) ? filters.paymentStatus : undefined,
      OR: q
        ? [
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
            { raceEvent: { title: { contains: q, mode: "insensitive" } } },
            { raceCategory: { name: { contains: q, mode: "insensitive" } } }
          ]
        : undefined
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
    take: 50
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
