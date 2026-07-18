import { revalidateTag, unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/db";
import { getRaceOptionalDetails } from "@/lib/race-optional-details";
import { filterRaces, getRaceById as getMockRaceById, getRaceBySlug as getMockRaceBySlug, getUpcomingRaces as getMockUpcomingRaces, sortRaceEvents, startOfToday, type RaceFilters } from "@/lib/races";
import type { RaceAnnouncement, RaceCategory, RaceEvent } from "@/types/race";

// Public race reads are cached in Next's data cache so the remote-loaded app stops hitting
// Postgres on every page view. Entries are tagged so a publish/edit/delete flushes them
// immediately; the revalidate window is a safety net for anything not explicitly flushed
// (e.g. availablePlaces ticking down — the register action still validates availability live).
export const RACES_CACHE_TAG = "public-races";
const RACES_REVALIDATE_SECONDS = 60;

/** Flush all cached public race reads. Call from any action that changes published race data. */
export function revalidateRacesCache() {
  revalidateTag(RACES_CACHE_TAG);
}

/**
 * The race data store could not be reached. Thrown (not swallowed) so a real outage is
 * distinguishable from "there are genuinely no races here".
 *
 * Previously every query error fell back to mock data, which meant a database outage rendered
 * as an empty result list on search pages and as "Race not found" on detail pages — the same
 * output as a legitimately empty query. Users read that as "no races in this wilaya" or "this
 * race was deleted", and because every response was still HTTP 200, uptime monitoring never
 * fired either. Route-level error boundaries now turn this into a visible, retryable error.
 */
export class RaceDataUnavailableError extends Error {
  constructor(operation: string, options?: { cause?: unknown }) {
    super(`Race data is temporarily unavailable (${operation}).`, options);
    this.name = "RaceDataUnavailableError";
  }
}

// Mock data is a deliberate convenience for running the app with no DATABASE_URL set. A query
// that *fails* is a different situation entirely and must not be papered over with fixtures.
function onQueryFailure(operation: string, error: unknown): never {
  console.error(`[race-repository] ${operation} failed:`, error);
  throw new RaceDataUnavailableError(operation, { cause: error });
}

type PrismaRaceEvent = {
  id: string;
  source: string;
  title: string;
  slug: string;
  description: string;
  shirtEnabled: boolean;
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
    raceType: string | null;
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

async function fetchUpcomingRaceEvents(limit?: number) {
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
  } catch (error) {
    onQueryFailure("upcoming race events", error);
  }
}

export const getUpcomingRaceEvents = unstable_cache(fetchUpcomingRaceEvents, ["public-upcoming-race-events"], {
  tags: [RACES_CACHE_TAG],
  revalidate: RACES_REVALIDATE_SECONDS
});

async function fetchRaceEventBySlug(slug: string) {
  if (!canUseDatabase()) {
    return getMockRaceBySlug(slug);
  }

  try {
    const prisma = getPrisma();
    const race = (await prisma.raceEvent.findUnique({
      where: { slug },
      include: raceInclude
    })) as PrismaRaceEvent | null;

    if (!race) return undefined;
    const optionalDetails = await getRaceOptionalDetails(prisma, race.id);
    return { ...mapRaceEvent(race), ...mapOptionalDetails(optionalDetails), announcements: await getPublicRaceAnnouncements(race.id) };
  } catch (error) {
    onQueryFailure("race by slug", error);
  }
}

export const getRaceEventBySlug = unstable_cache(fetchRaceEventBySlug, ["public-race-event-by-slug"], {
  tags: [RACES_CACHE_TAG],
  revalidate: RACES_REVALIDATE_SECONDS
});

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

    if (!race) return undefined;
    const optionalDetails = await getRaceOptionalDetails(prisma, race.id);
    return { ...mapRaceEvent(race), ...mapOptionalDetails(optionalDetails), announcements: await getPublicRaceAnnouncements(race.id) };
  } catch (error) {
    onQueryFailure("race by id", error);
  }
}

async function fetchRaceEvents(filters: RaceFilters) {
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
          : undefined,
        // Hide past (completed) races by default — keep only races that haven't finished
        // (end date in the future, or for single-day events a start date not in the past).
        // The user can opt back in to old races with `past=1`.
        AND: filters.past
          ? undefined
          : [
              {
                OR: [
                  { endDate: { gte: startOfToday() } },
                  { AND: [{ endDate: null }, { startDate: { gte: startOfToday() } }] }
                ]
              }
            ]
      },
      include: raceInclude,
      orderBy: {
        startDate: "asc"
      }
    })) as PrismaRaceEvent[];

    return sortRaceEvents(races.map(mapRaceEvent), filters.sort);
  } catch (error) {
    onQueryFailure("race search", error);
  }
}

export const findRaceEvents = unstable_cache(fetchRaceEvents, ["public-find-race-events"], {
  tags: [RACES_CACHE_TAG],
  revalidate: RACES_REVALIDATE_SECONDS
});

function mapRaceEvent(race: PrismaRaceEvent): RaceEvent {
  return {
    id: race.id,
    source: race.source as RaceEvent["source"],
    title: race.title,
    slug: race.slug,
    description: race.description,
    shirtEnabled: race.shirtEnabled,
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
      name: race.organization?.name ?? race.organizerName ?? "ZidRun",
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

function mapOptionalDetails(details: { elevationGainText: string | null; conditions: string | null }) {
  return {
    elevationGainText: details.elevationGainText ?? undefined,
    conditions: details.conditions ?? undefined
  };
}

function mapRaceCategory(category: PrismaRaceEvent["categories"][number]): RaceCategory {
  return {
    id: category.id,
    name: category.name,
    raceType: (category.raceType as RaceCategory["raceType"]) ?? undefined,
    distanceKm: category.distanceKm,
    elevationGainM: category.elevationGainM ?? undefined,
    priceDzd: category.priceDzd ?? undefined,
    maxParticipants: category.maxParticipants ?? undefined,
    startTime: category.startTime?.toISOString(),
    cutoffTimeMin: category.cutoffTimeMin ?? undefined,
    gpxFileUrl: category.gpxFileUrl ?? undefined
  };
}

async function getPublicRaceAnnouncements(raceEventId: string): Promise<RaceAnnouncement[]> {
  const rows = await getPrisma().$queryRaw<
    Array<{
      id: string;
      title: string;
      body: string;
      authorName: string;
      publishedAt: Date;
    }>
  >`
    SELECT
      announcement."id",
      announcement."title",
      announcement."body",
      CONCAT(author."firstName", ' ', author."lastName") AS "authorName",
      announcement."publishedAt"
    FROM "RaceAnnouncement" announcement
    INNER JOIN "User" author ON author."id" = announcement."authorId"
    WHERE announcement."raceEventId" = ${raceEventId}
    ORDER BY announcement."publishedAt" DESC
  `;

  return rows.map((row) => ({
    ...row,
    publishedAt: row.publishedAt.toISOString()
  }));
}

function canUseDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
