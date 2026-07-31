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
  let owner: string | null = null;
  // Taken before the mutation so the reconciliation below can tell a row this request wrote from
  // one that already existed.
  const claimedAt = new Date();

  if (idempotencyKey) {
    const claim = await claimIdempotent(request, viewer.id, endpoint, idempotencyKey, idempotencyBody);
    if (claim.outcome === "replay") return claim.response;
    owner = claim.owner;
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

    if (idempotencyKey && owner) {
      await completeIdempotent(viewer.id, endpoint, idempotencyKey, owner, 201, dto);
    }

    return apiOk(request, dto, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      // Every RegistrationError is raised either before any write or from a transaction that rolled
      // back, so nothing was committed and the key is free to be retried.
      if (idempotencyKey && owner) {
        await releaseIdempotent(viewer.id, endpoint, idempotencyKey, owner);
      }

      // RegistrationError already carries the right status and a user-facing message from the
      // shared domain layer; map it onto this facade's envelope without rewording it.
      const code = error.status === 409 ? "CONFLICT" : error.status === 404 ? "NOT_FOUND" : error.status === 422 ? "VALIDATION_FAILED" : "BAD_REQUEST";
      throw new ApiError(code, error.message);
    }

    // Any other failure may have happened AFTER the registration committed —
    // createRaceRegistrationForUser() sends notifications once the transaction is done, and that
    // work can throw. Releasing the reservation here would be the worst outcome: the runner is
    // registered, but their retry would find the reservation gone, re-run, and collide with their
    // own row, so a successful registration would report "you are already registered".
    //
    // So reconcile against the database instead of guessing. Only a registration created since this
    // reservation was taken counts as ours — an older one belongs to a different attempt and must
    // still surface as a duplicate.
    if (idempotencyKey && owner) {
      const committed = await findRegistrationCreatedSince(viewer.id, race.id, claimedAt);

      if (committed) {
        const dto = toRegistrationDto(committed);
        await completeIdempotent(viewer.id, endpoint, idempotencyKey, owner, 201, dto);
        console.error(
          `[api/v1][registration] post-commit failure for registration ${committed.id}; the registration stands`,
          error
        );
        return apiOk(request, dto, { status: 201 });
      }

      await releaseIdempotent(viewer.id, endpoint, idempotencyKey, owner);
    }

    throw error;
  }
});

/**
 * The caller's registration for this race created at or after [since], if any.
 *
 * The time bound is what distinguishes "the row this request just wrote" from "a row an earlier
 * attempt wrote"; without it a genuine duplicate would be reported as a fresh success.
 */
async function findRegistrationCreatedSince(userId: string, raceEventId: string, since: Date) {
  return getPrisma().raceRegistration.findFirst({
    where: { userId, raceEventId, createdAt: { gte: since } },
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
    orderBy: { createdAt: "desc" }
  });
}
