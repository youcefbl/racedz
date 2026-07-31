import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { toMeDto } from "@/lib/api/v1/dto";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const meSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  phone: true,
  gender: true,
  dateOfBirth: true,
  wilaya: true,
  city: true,
  emailVerifiedAt: true,
  mfaEnabled: true,
  language: true,
  theme: true,
  profilePrivate: true
} as const;

/** The signed-in runner's own profile, plus the season counters the Account screen shows. */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const prisma = getPrisma();

  const [user, raceCount, runAggregate] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewer.id }, select: meSelect }),
    prisma.raceRegistration.count({ where: { userId: viewer.id, status: { notIn: ["CANCELLED", "REJECTED"] } } }),
    prisma.runnerRun.aggregate({ where: { userId: viewer.id }, _sum: { distanceKm: true }, _count: true })
  ]);

  if (!user) throw new ApiError("SESSION_EXPIRED", "Your session has expired. Please sign in again.");

  return apiOk(request, {
    ...toMeDto(user),
    season: {
      races: raceCount,
      runs: runAggregate._count,
      // Rounded to one decimal because that is the precision the Account screen displays; the
      // raw per-run distances stay server-side.
      totalDistanceKm: Math.round((runAggregate._sum.distanceKm ?? 0) * 10) / 10
    }
  });
});

// Only the fields the runner may edit about themselves. Email, role, and verification state are
// deliberately absent: changing an email is a verification flow, not a profile edit.
const profileSchema = z.object({
  firstName: z.string().trim().min(2).max(60).optional(),
  lastName: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().min(6).max(24).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional(),
  wilaya: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional()
});

export const PATCH = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-me-update", viewer.id), 30, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many updates. Try again shortly."));

  const parsed = profileSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.", {
      fields: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).flatMap(([field, messages]) =>
          messages?.[0] ? [[field, messages[0]]] : []
        )
      )
    });
  }

  const { dateOfBirth, ...rest } = parsed.data;
  const user = await getPrisma().user.update({
    where: { id: viewer.id },
    data: {
      ...rest,
      ...(dateOfBirth ? { dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`) } : {})
    },
    select: meSelect
  });

  return apiOk(request, toMeDto(user));
});
