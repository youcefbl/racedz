"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import {
  buildOtpAuthUrl,
  consumeBackupCode,
  generateBackupCodes,
  generateMfaSecret,
  hashBackupCodes,
  verifyTotp
} from "@/lib/mfa";

export type MfaEnrollment = {
  secret: string;
  otpauthUrl: string;
};

export type MfaActionResult = {
  error?: string;
  success?: string;
  backupCodes?: string[];
};

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }
  return session.user.id;
}

/**
 * Begin TOTP enrollment: generate a secret, store it while still DISABLED (so it can't be used to
 * gate login until confirmed), and return the provisioning details for the authenticator app.
 * Re-callable — regenerates the pending secret each time until enrollment is confirmed.
 */
export async function startMfaEnrollmentAction(): Promise<MfaEnrollment> {
  const userId = await requireUserId();
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
  if (!user) throw new Error("Account not found.");
  if (user.mfaEnabled) throw new Error("Two-factor authentication is already enabled.");

  const secret = generateMfaSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: secret, mfaBackupCodes: [] }
  });

  return { secret, otpauthUrl: buildOtpAuthUrl(secret, user.email) };
}

/** Confirm enrollment by verifying a code against the pending secret, then enable MFA + issue codes. */
export async function confirmMfaAction(_previous: MfaActionResult, formData: FormData): Promise<MfaActionResult> {
  const userId = await requireUserId();
  const prisma = getPrisma();
  const code = String(formData.get("code") ?? "").trim();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mfaSecret: true, mfaEnabled: true } });
  if (!user?.mfaSecret) {
    return { error: "Start enrollment first, then enter a code." };
  }
  if (user.mfaEnabled) {
    return { error: "Two-factor authentication is already enabled." };
  }
  if (!verifyTotp(user.mfaSecret, code)) {
    return { error: "That code didn't match. Check your authenticator app and try again." };
  }

  const backupCodes = generateBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true, mfaEnabledAt: new Date(), mfaBackupCodes: hashBackupCodes(backupCodes) }
  });

  revalidatePath("/account/security");
  return { success: "Two-factor authentication is on.", backupCodes };
}

/** Disable MFA. Requires a current TOTP or a recovery code so a hijacked session can't turn it off. */
export async function disableMfaAction(_previous: MfaActionResult, formData: FormData): Promise<MfaActionResult> {
  const userId = await requireUserId();
  const prisma = getPrisma();
  const code = String(formData.get("code") ?? "").trim();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true }
  });
  if (!user?.mfaEnabled || !user.mfaSecret) {
    return { error: "Two-factor authentication is not enabled." };
  }

  const validCode = verifyTotp(user.mfaSecret, code) || consumeBackupCode(code, user.mfaBackupCodes) !== null;
  if (!validCode) {
    return { error: "Enter a valid authenticator or recovery code to disable two-factor." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null, mfaEnabledAt: null, mfaBackupCodes: [] }
  });

  revalidatePath("/account/security");
  return { success: "Two-factor authentication is off." };
}
