"use server";

import { headers } from "next/headers";
import { getPrisma } from "@/lib/db";
import { getDictionary, getLocale } from "@/lib/i18n";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/password-reset";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export type ForgotPasswordState = { ok?: boolean; error?: string };

/**
 * Request a password-reset email. Always reports success so we never reveal whether an
 * email exists. Only accounts that actually use password login (have a hash) get an email.
 */
export async function requestPasswordResetAction(
  _previous: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const t = getDictionary(getLocale(formData.get("lang") as string | null)).auth;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return { error: t.errInvalidInput };
  }

  const ip = clientIp(await headers());
  if (ip && !checkRateLimit(`forgot-password:${ip}`, 5, 10 * 60_000).ok) {
    return { ok: true };
  }

  const user = await getPrisma().user.findUnique({
    where: { email },
    select: { id: true, firstName: true, email: true, passwordHash: true }
  });

  if (user?.passwordHash) {
    const token = await createPasswordResetToken(user.id);
    await sendPasswordResetEmail({ to: user.email, firstName: user.firstName, token });
  }

  return { ok: true };
}
