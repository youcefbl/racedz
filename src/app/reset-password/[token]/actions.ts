"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { resetPasswordSchema } from "@/lib/validations";

export type ResetPasswordState = {
  error?: string;
  fieldErrors?: { password?: string; confirmPassword?: string };
};

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const locale = getLocale(formData.get("lang") as string | null);
  const t = getDictionary(locale).auth;
  const token = String(formData.get("token") ?? "");

  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? "")
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: t.errCheckFields,
      fieldErrors: { password: fieldErrors.password?.[0], confirmPassword: fieldErrors.confirmPassword?.[0] }
    };
  }

  // Cost 12 matches the registration path (OWASP baseline).
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const result = await consumePasswordResetToken(token, passwordHash);

  if (!result.ok) {
    return { error: t.resetInvalid };
  }

  redirect(withLocale("/login?reset=1", locale));
}
