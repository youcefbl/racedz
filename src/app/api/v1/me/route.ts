import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { toMeDto } from "@/lib/api/v1/dto";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { rebuildPlanAfterProfileChange } from "@/lib/coach/service";

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
  profilePrivate: true,
  distanceUnit: true
} as const;

/** The signed-in runner's own profile, plus the season counters the Account screen shows. */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const prisma = getPrisma();

  const [user, raceCount, runAggregate] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewer.id }, select: meSelect }),
    prisma.raceRegistration.count({ where: { userId: viewer.id, status: { notIn: ["CANCELLED", "REJECTED"] } } }),
    // Tombstoned runs are deleted runs; the Account counters must not keep counting them.
    prisma.runnerRun.aggregate({ where: { userId: viewer.id, deletedAt: null }, _sum: { distanceKm: true }, _count: true })
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

/**
 * Makes an optional field clearable. An empty string means "remove this value" and becomes null,
 * which is what the client sends when the user empties the input; omitting the field entirely still
 * means "leave it alone". Without this the two are indistinguishable on the wire — the client's
 * JSON drops nulls — so a runner could never delete a phone number they had once entered.
 *
 * Only for columns that are nullable in the database. `firstName`/`lastName` are not: a runner must
 * have a name, so blanking those is a validation error rather than a clear.
 */
function clearable(schema: z.ZodString) {
  return z
    .union([schema, z.literal("")])
    .transform<string | null>((value) => (value === "" ? null : value));
}

// Only the fields the runner may edit about themselves. Email, role, and verification state are
// deliberately absent: changing an email is a verification flow, not a profile edit.
const profileSchema = z.object({
  firstName: z.string().trim().min(2).max(60).optional(),
  lastName: z.string().trim().min(2).max(60).optional(),
  phone: clearable(z.string().trim().min(6).max(24)).optional(),
  gender: z.union([z.enum(["MALE", "FEMALE", "OTHER"]), z.literal("")])
    .transform((value) => (value === "" ? null : value))
    .optional(),
  dateOfBirth: clearable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")).optional(),
  wilaya: clearable(z.string().trim().max(60).min(1)).optional(),
  city: clearable(z.string().trim().max(60).min(1)).optional()
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
  // Same reason as the web profile action: the planner reads age from this column for its age
  // bands, so the actionable week has to be rebuilt when it moves. Read first so a save that does
  // not touch the birth date leaves a good plan alone.
  const previousDateOfBirth =
    dateOfBirth === undefined
      ? undefined
      : (await getPrisma().user.findUnique({ where: { id: viewer.id }, select: { dateOfBirth: true } }))?.dateOfBirth ?? null;

  const user = await getPrisma().user.update({
    where: { id: viewer.id },
    data: {
      ...rest,
      // `undefined` leaves the column alone, `null` clears it — Prisma distinguishes the two, which
      // is exactly the distinction the schema above preserves.
      ...(dateOfBirth === undefined
        ? {}
        : { dateOfBirth: dateOfBirth === null ? null : new Date(`${dateOfBirth}T00:00:00.000Z`) })
    },
    select: meSelect
  });

  if (previousDateOfBirth !== undefined && (previousDateOfBirth?.getTime() ?? null) !== (user.dateOfBirth?.getTime() ?? null)) {
    await rebuildPlanAfterProfileChange(viewer.id);
  }

  return apiOk(request, toMeDto(user));
});
