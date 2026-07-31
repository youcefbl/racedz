import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, withApi } from "@/lib/api/v1/http";
import { optionalMobileUser } from "@/lib/api/v1/guard";
import { raceSelect, toRaceDetail } from "@/lib/api/v1/dto";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ idOrSlug: string }> };

/**
 * Race detail. Public, but personalizes when the caller sends a valid access token: `myRegistration`
 * tells the app whether to show "Register" or the existing registration's status without a second
 * round trip. An anonymous caller simply gets null there — no other user's registration is ever
 * visible, and the lookup is keyed on the caller's own id.
 */
export const GET = withApi(async (request, context: Context) => {
  const ip = clientIp(request.headers);
  const limited = enforceRateLimit(`v1-race-detail:${ip ?? "unknown"}`, 120, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const { idOrSlug } = await context.params;
  const prisma = getPrisma();

  const race = await prisma.raceEvent.findFirst({
    // Accepts either identifier so deep links can use the human-readable slug while list responses
    // keep using ids. Draft/cancelled races are excluded here, not filtered in the client.
    where: { status: "PUBLISHED", OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: raceSelect
  });

  if (!race) throw new ApiError("NOT_FOUND", "This race is not available.");

  const announcements = await prisma.raceAnnouncement.findMany({
    where: { raceEventId: race.id },
    select: { id: true, title: true, body: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 20
  });

  const viewer = await optionalMobileUser(request);
  const myRegistration = viewer
    ? await prisma.raceRegistration.findFirst({
        where: { userId: viewer.id, raceEventId: race.id },
        select: { id: true, status: true, paymentStatus: true, raceCategoryId: true },
        orderBy: { createdAt: "desc" }
      })
    : null;

  return apiOk(request, { ...toRaceDetail(race, announcements), myRegistration });
});
