import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

/**
 * Data export: everything ZidRun holds about the caller, returned to the caller only.
 *
 * Bounded on purpose. Runs are capped and their GPS route arrays are excluded — a full route
 * history is the most sensitive thing in the account, it would make this response enormous, and
 * shipping it through a generic "export" tap is exactly how precise location ends up in a
 * screenshot or a share sheet. Route data has its own per-run GPX export, which is an explicit,
 * one-run-at-a-time action.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);
  const limited = enforceRateLimit(rateLimitKey("v1-export", viewer.id), 3, 60 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "You can request an export a few times per hour."));

  const prisma = getPrisma();
  const [user, registrations, runs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewer.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        arabicFullName: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
        wilaya: true,
        city: true,
        commune: true,
        language: true,
        theme: true,
        profilePrivate: true,
        emailVerifiedAt: true,
        createdAt: true
      }
    }),
    prisma.raceRegistration.findMany({
      where: { userId: viewer.id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        bibNumber: true,
        createdAt: true,
        raceEvent: { select: { title: true, startDate: true, wilaya: true } },
        raceCategory: { select: { name: true, distanceKm: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.runnerRun.findMany({
      where: { userId: viewer.id },
      select: {
        id: true,
        startedAt: true,
        distanceKm: true,
        durationSeconds: true,
        averagePaceSecondsPerKm: true,
        elevationGainM: true,
        title: true,
        source: true
      },
      orderBy: { startedAt: "desc" },
      take: 1000
    })
  ]);

  if (!user) throw new ApiError("SESSION_EXPIRED", "Your session has expired. Please sign in again.");

  logSecurityEvent("data_export_generated", { userId: viewer.id, registrations: registrations.length, runs: runs.length });

  return apiOk(request, {
    generatedAt: new Date().toISOString(),
    notice: "Run GPS routes are not included here. Export a route from that run's own GPX export.",
    profile: user,
    registrations,
    runs
  });
});
