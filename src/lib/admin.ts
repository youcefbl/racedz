import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";

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

  return prisma.organization.findMany({
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
