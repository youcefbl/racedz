import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { claimIdempotent, completeIdempotent, readIdempotencyKey, releaseIdempotent } from "@/lib/api/v1/idempotency";
import { toRegistrationDto } from "@/lib/api/v1/dto";
import { createRaceRegistrationForUser, RegistrationError } from "@/lib/registrations";
import { raceRegistrationSchema } from "@/lib/validations";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ idOrSlug: string }> };

/**
 * Register the signed-in runner for a race.
 *
 * All the rules that matter stay on the server, in the same createRaceRegistrationForUser() the
 * website calls: PUBLISHED + registration OPEN, the close date, the per-category row lock that
 * makes capacity checks safe against a registration-open herd, the guarded availablePlaces
 * decrement, and the (userId, raceCategoryId) unique constraint that turns a duplicate into a 409.
 * Nothing here re-implements any of that — the app is a client, not a second source of truth.
 *
 * On top of that, an `Idempotency-Key` header makes a retried POST safe: the stored 201 is replayed
 * rather than a second registration created.
 */
export const POST = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { idOrSlug } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-race-register", viewer.id), 20, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many attempts. Try again shortly."));

  const race = await getPrisma().raceEvent.findFirst({
    where: { status: "PUBLISHED", OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true }
  });
  if (!race) throw new ApiError("NOT_FOUND", "This race is not available.");

  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const endpoint = "POST /api/v1/races/:id/registrations";
  const idempotencyKey = readIdempotencyKey(request);
  const idempotencyBody = { race: race.id, ...body };

  // email is on the shared schema but always taken from the session — a client must not be able
  // to register a race under another address.
  const input = { ...body, email: viewer.email };

  // The shared domain helper answers a schema miss with one generic message, which is fine for the
  // website (its form validates the same rules client-side first) but leaves a mobile client unable
  // to highlight the offending input. Parse here as well so the response carries field details.
  const parsed = raceRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).flatMap(([field, messages]) =>
        messages?.[0] ? [[field, messages[0]]] : []
      )
    );
    // Field NAMES only — the values are a runner's phone, birth date, and emergency contact, none
    // of which belong in a server log. Enough to tell a client bug from a user typo.
    console.warn("[api/v1][registration] rejected fields:", Object.keys(fields).join(", "));
    throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.", { fields });
  }

  // Reserved BEFORE the mutation so the unique constraint serializes concurrent retries. Validation
  // runs first so a malformed body cannot burn the key.
  if (idempotencyKey) {
    const claim = await claimIdempotent(request, viewer.id, endpoint, idempotencyKey, idempotencyBody);
    if (claim.outcome === "replay") return claim.response;
  }

  try {
    const registration = await createRaceRegistrationForUser({
      userId: viewer.id,
      raceEventId: race.id,
      input
    });

    const dto = toRegistrationDto({
      ...registration,
      raceEvent: registration.raceEvent,
      raceCategory: registration.raceCategory
    });

    if (idempotencyKey) {
      await completeIdempotent(viewer.id, endpoint, idempotencyKey, 201, dto);
    }

    return apiOk(request, dto, { status: 201 });
  } catch (error) {
    // The registration transaction either commits fully or rolls back, so a failure here left
    // nothing behind and the user may retry with the same key.
    if (idempotencyKey) {
      await releaseIdempotent(viewer.id, endpoint, idempotencyKey);
    }

    if (error instanceof RegistrationError) {
      // RegistrationError already carries the right status and a user-facing message from the
      // shared domain layer; map it onto this facade's envelope without rewording it.
      const code = error.status === 409 ? "CONFLICT" : error.status === 404 ? "NOT_FOUND" : error.status === 422 ? "VALIDATION_FAILED" : "BAD_REQUEST";
      throw new ApiError(code, error.message);
    }
    throw error;
  }
});
