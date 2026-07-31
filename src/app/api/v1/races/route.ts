import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, pageMeta, parsePageParams, withApi } from "@/lib/api/v1/http";
import { raceSelect, toRaceSummary } from "@/lib/api/v1/dto";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Mirrors the `RaceType` enum in prisma/schema.prisma. */
const RACE_TYPES = [
  "ROAD",
  "TRAIL",
  "ULTRA_TRAIL",
  "MARATHON",
  "HALF_MARATHON",
  "TEN_K",
  "FIVE_K",
  "KIDS",
  "CHARITY",
  "OTHER"
] as const;

type RaceType = (typeof RACE_TYPES)[number];

/**
 * Public, paginated race discovery for the native Races screen.
 *
 * Only PUBLISHED races are ever returned — the same visibility rule the website's race repository
 * applies — so drafts, rejected imports, and organizer-private events cannot leak through this
 * client. Unlike the website's cached full-list read (src/lib/race-repository.ts), this pages at
 * the database so a phone on a slow connection never downloads the whole catalogue.
 */
export const GET = withApi(async (request) => {
  const ip = clientIp(request.headers);
  const limited = enforceRateLimit(`v1-races:${ip ?? "unknown"}`, 120, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const url = new URL(request.url);
  const { page, limit, skip } = parsePageParams(url);

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const wilaya = (url.searchParams.get("wilaya") ?? "").trim().slice(0, 60) || undefined;
  const distance = Number(url.searchParams.get("distance") ?? "");

  // Validate against the enum instead of casting: Prisma raises on an unknown enum value, which
  // surfaced as a 500 for a caller who simply mistyped a filter. A bad filter is the caller's
  // mistake, so answer 422 and name the accepted values.
  const rawType = (url.searchParams.get("type") ?? "").trim();
  if (rawType && !RACE_TYPES.includes(rawType as RaceType)) {
    throw new ApiError("VALIDATION_FAILED", "Unknown race type filter.", { allowed: RACE_TYPES.join(", ") });
  }
  const type = rawType || undefined;
  const includePast = url.searchParams.get("past") === "1";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const where: Prisma.RaceEventWhereInput = {
    status: "PUBLISHED",
    ...(wilaya ? { wilaya } : {}),
    ...(type ? { raceType: type as RaceType } : {}),
    ...(Number.isFinite(distance) && distance > 0 ? { categories: { some: { distanceKm: distance } } } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
            { wilaya: { contains: query, mode: "insensitive" } },
            { organizerName: { contains: query, mode: "insensitive" } }
          ]
        }
      : {}),
    // Finished races are hidden unless explicitly requested, matching the website's default.
    ...(includePast
      ? {}
      : {
          // Kept in AND so it composes with the free-text OR above instead of replacing it.
          AND: [
            {
              OR: [
                { endDate: { gte: startOfToday } },
                { AND: [{ endDate: null }, { startDate: { gte: startOfToday } }] }
              ]
            }
          ]
        })
  } as Prisma.RaceEventWhereInput;

  const prisma = getPrisma();
  const [total, races] = await Promise.all([
    prisma.raceEvent.count({ where }),
    prisma.raceEvent.findMany({ where, select: raceSelect, orderBy: { startDate: "asc" }, skip, take: limit })
  ]);

  return apiOk(request, races.map(toRaceSummary), { meta: pageMeta(total, page, limit) });
});
