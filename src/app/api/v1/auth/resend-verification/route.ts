import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { createEmailVerificationToken, sendAccountVerificationEmail } from "@/lib/email-verification";
import { normalizeLocale } from "@/lib/appearance";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  language: z.string().optional()
});

/**
 * Re-send the account activation email.
 *
 * Always answers 200 with the same body whether the address exists, is already verified, or has
 * never been seen. Anything else turns this into an account-existence oracle, and unlike sign-up
 * (where the user is actively choosing an address) there is no product reason to confirm.
 */
export const POST = withApi(async (request) => {
  const ip = clientIp(request.headers);
  const limited = enforceRateLimit(`v1-resend-verification:${ip ?? "unknown"}`, 5, 15 * 60_000);
  if (limited) {
    return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Try again shortly."));
  }

  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    throw new ApiError("VALIDATION_FAILED", "Enter a valid email address.");
  }

  const user = await getPrisma().user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, firstName: true, emailVerifiedAt: true, blockedAt: true }
  });

  if (user && !user.emailVerifiedAt && !user.blockedAt) {
    const token = await createEmailVerificationToken(user.id);
    await sendAccountVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      token,
      locale: normalizeLocale(parsed.data.language) ?? "en"
    });
  }

  return apiOk(request, { sent: true });
});
