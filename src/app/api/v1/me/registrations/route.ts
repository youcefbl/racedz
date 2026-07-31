import { getPrisma } from "@/lib/db";
import { apiOk, pageMeta, parsePageParams, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { toRegistrationDto } from "@/lib/api/v1/dto";

export const dynamic = "force-dynamic";

/** The caller's own race registrations, newest first. Scoped by userId — never by a client filter. */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const { page, limit, skip } = parsePageParams(new URL(request.url));
  const prisma = getPrisma();

  const [total, rows] = await Promise.all([
    prisma.raceRegistration.count({ where: { userId: viewer.id } }),
    prisma.raceRegistration.findMany({
      where: { userId: viewer.id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentProofUrl: true,
        bibNumber: true,
        createdAt: true,
        raceEvent: {
          select: {
            id: true,
            slug: true,
            title: true,
            startDate: true,
            wilaya: true,
            city: true,
            baridiMobNumber: true,
            ccpAccount: true,
            ccpKey: true,
            paymentNote: true
          }
        },
        raceCategory: { select: { id: true, name: true, distanceKm: true, priceDzd: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    })
  ]);

  return apiOk(request, rows.map(toRegistrationDto), { meta: pageMeta(total, page, limit) });
});
