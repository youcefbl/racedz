import { getPrisma } from "@/lib/db";
import { filterRaces, getRaceById as getMockRaceById, getRaceBySlug as getMockRaceBySlug, getUpcomingRaces as getMockUpcomingRaces, type RaceFilters } from "@/lib/races";
import type { RaceCategory, RaceEvent } from "@/types/race";

type PrismaRaceEvent = {
  id: string;
  source: string;
  title: string;
  slug: string;
  description: string;
  raceType: string;
  status: string;
  registrationStatus: string;
  startDate: Date;
  endDate: Date | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  wilaya: string;
  city: string;
  commune: string | null;
  address: string | null;
  mainImageUrl: string | null;
  organizerName: string | null;
  organizerUrl: string | null;
  rules: string | null;
  requiredDocuments: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  maxParticipants: number | null;
  availablePlaces: number | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  categories: Array<{
    id: string;
    name: string;
    distanceKm: number;
    elevationGainM: number | null;
    priceDzd: number | null;
    maxParticipants: number | null;
    startTime: Date | null;
    cutoffTimeMin: number | null;
    gpxFileUrl: string | null;
  }>;
};

const raceInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  },
  categories: {
    orderBy: {
      distanceKm: "asc" as const
    }
  }
};

export async function getUpcomingRaceEvents(limit?: number) {
  if (!canUseDatabase()) {
    return getMockUpcomingRaces(limit);
  }

  try {
    const prisma = getPrisma();
    const races = (await prisma.raceEvent.findMany({
      where: {
        status: "PUBLISHED"
      },
      include: raceInclude,
      orderBy: {
        startDate: "asc"
      },
      take: limit
    })) as PrismaRaceEvent[];

    return races.map(mapRaceEvent);
  } catch {
    return getMockUpcomingRaces(limit);
  }
}

export async function getRaceEventBySlug(slug: string) {
  if (!canUseDatabase()) {
    return getMockRaceBySlug(slug);
  }

  try {
    const prisma = getPrisma();
    const race = (await prisma.raceEvent.findUnique({
      where: { slug },
      include: raceInclude
    })) as PrismaRaceEvent | null;

    return race ? mapRaceEvent(race) : undefined;
  } catch {
    return getMockRaceBySlug(slug);
  }
}

export async function getRaceEventById(id: string) {
  if (!canUseDatabase()) {
    return getMockRaceById(id);
  }

  try {
    const prisma = getPrisma();
    const race = (await prisma.raceEvent.findUnique({
      where: { id },
      include: raceInclude
    })) as PrismaRaceEvent | null;

    return race ? mapRaceEvent(race) : undefined;
  } catch {
    return getMockRaceById(id);
  }
}

export async function findRaceEvents(filters: RaceFilters) {
  if (!canUseDatabase()) {
    return filterRaces(filters);
  }

  try {
    const prisma = getPrisma();
    const races = (await prisma.raceEvent.findMany({
      where: {
        status: "PUBLISHED",
        wilaya: filters.wilaya || undefined,
        raceType: filters.type || undefined,
        registrationStatus: filters.registrationStatus || undefined,
        OR: filters.q
          ? [
              { title: { contains: filters.q, mode: "insensitive" } },
              { city: { contains: filters.q, mode: "insensitive" } },
              { commune: { contains: filters.q, mode: "insensitive" } },
              { organizerName: { contains: filters.q, mode: "insensitive" } },
              { organization: { name: { contains: filters.q, mode: "insensitive" } } }
            ]
          : undefined,
        categories: filters.distance
          ? {
              some: {
                distanceKm: Number(filters.distance)
              }
            }
          : undefined
      },
      include: raceInclude,
      orderBy: {
        startDate: "asc"
      }
    })) as PrismaRaceEvent[];

    return races.map(mapRaceEvent);
  } catch {
    return filterRaces(filters);
  }
}

function mapRaceEvent(race: PrismaRaceEvent): RaceEvent {
  return {
    id: race.id,
    source: race.source as RaceEvent["source"],
    title: race.title,
    slug: race.slug,
    description: race.description,
    raceType: race.raceType as RaceEvent["raceType"],
    status: race.status as RaceEvent["status"],
    registrationStatus: race.registrationStatus as RaceEvent["registrationStatus"],
    startDate: race.startDate.toISOString(),
    endDate: race.endDate?.toISOString(),
    registrationOpenAt: race.registrationOpenAt?.toISOString(),
    registrationCloseAt: race.registrationCloseAt?.toISOString(),
    wilaya: race.wilaya,
    city: race.city,
    commune: race.commune ?? undefined,
    address: race.address ?? undefined,
    organizer: {
      id: race.organization?.id ?? "platform",
      name: race.organization?.name ?? race.organizerName ?? "RaceDZ",
      slug: race.organization?.slug ?? "racedz",
      url: race.organizerUrl ?? undefined
    },
    mainImageUrl: race.mainImageUrl ?? undefined,
    rules: race.rules ?? undefined,
    requiredDocuments: race.requiredDocuments ?? undefined,
    contactEmail: race.contactEmail ?? undefined,
    contactPhone: race.contactPhone ?? undefined,
    maxParticipants: race.maxParticipants ?? undefined,
    availablePlaces: race.availablePlaces ?? undefined,
    categories: race.categories.map(mapRaceCategory)
  };
}

function mapRaceCategory(category: PrismaRaceEvent["categories"][number]): RaceCategory {
  return {
    id: category.id,
    name: category.name,
    distanceKm: category.distanceKm,
    elevationGainM: category.elevationGainM ?? undefined,
    priceDzd: category.priceDzd ?? undefined,
    maxParticipants: category.maxParticipants ?? undefined,
    startTime: category.startTime?.toISOString(),
    cutoffTimeMin: category.cutoffTimeMin ?? undefined,
    gpxFileUrl: category.gpxFileUrl ?? undefined
  };
}

function canUseDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
