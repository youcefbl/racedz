import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { ApiError, apiError, apiOk, readJsonBody, withApi } from "@/lib/api/v1/http";
import { createEmailVerificationToken, sendAccountVerificationEmail } from "@/lib/email-verification";
import { normalizeLocale } from "@/lib/appearance";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// The app collects one "Full name" field (03-create-account.png) rather than the web's two, so it
// posts `fullName` and the split happens here. Everything else matches registerUserSchema: the
// account is created unverified with no session, exactly like the web sign-up.
const nativeRegisterSchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters."),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms and Privacy Policy." }) }),
  language: z.string().optional()
});

export const POST = withApi(async (request) => {
  const ip = clientIp(request.headers);
  const limited = enforceRateLimit(`v1-register:${ip ?? "unknown"}`, 5, 10 * 60_000);
  if (limited) {
    return apiError(request, new ApiError("RATE_LIMITED", "Too many sign-up attempts. Try again shortly."));
  }

  const parsed = nativeRegisterSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    throw new ApiError("VALIDATION_FAILED", "Check the highlighted fields.", {
      fields: Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).flatMap(([field, messages]) =>
          messages?.[0] ? [[field, messages[0]]] : []
        )
      )
    });
  }

  const { firstName, lastName } = splitFullName(parsed.data.fullName);
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });

  if (existing) {
    // The website already answers "that email is taken" on its sign-up form, so this endpoint is
    // not a new enumeration surface — matching it keeps the two clients' copy consistent.
    throw new ApiError("CONFLICT", "An account with this email already exists.", { field: "email" });
  }

  // Cost 12 matches the web sign-up (current OWASP bcrypt baseline).
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const locale = normalizeLocale(parsed.data.language) ?? "en";
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      firstName,
      lastName,
      role: "RUNNER",
      language: locale
    },
    select: { id: true, email: true, firstName: true }
  });

  const token = await createEmailVerificationToken(user.id);
  const delivery = await sendAccountVerificationEmail({
    to: user.email,
    firstName: user.firstName,
    token,
    locale
  });

  // No tokens are returned: the account cannot sign in until the email is verified, which is the
  // same gate verifyLoginCredentials enforces for the website.
  return apiOk(
    request,
    { email: user.email, verificationEmailSent: delivery.ok, requiresEmailVerification: true },
    { status: 201 }
  );
});

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "ZidRun",
    // A single-word name still has to satisfy the profile's two-name shape; "Runner" is the same
    // placeholder the Google sign-in path uses (src/lib/native-auth.ts).
    lastName: parts.slice(1).join(" ") || "Runner"
  };
}
