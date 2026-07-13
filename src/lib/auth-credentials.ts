import "server-only";

import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { isEmailVerified } from "@/lib/email-verification";
import { consumeBackupCode, verifyTotp } from "@/lib/mfa";
import type { UserRole } from "@/types/race";

export type CredentialUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  firstLoginAt: Date | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaBackupCodes: string[];
  organizationIds: string[];
};

/**
 * Validate an email/password pair for the credentials provider WITHOUT any side effects.
 * Returns the user (including MFA state) when the password is correct and the account may sign in
 * (has a password, is not blocked, email is verified); otherwise null. Shared by the Auth.js
 * `authorize` callback and the login server action so the password is checked identically in both.
 */
export async function verifyLoginCredentials(email: string, password: string): Promise<CredentialUser | null> {
  const user = await getPrisma().user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      passwordHash: true,
      blockedAt: true,
      firstLoginAt: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaBackupCodes: true,
      organizations: { select: { organizationId: true } }
    }
  });

  if (!user?.passwordHash) return null;
  if (user.blockedAt) return null;
  if (!(await isEmailVerified(user.email))) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    firstLoginAt: user.firstLoginAt ?? null,
    mfaEnabled: user.mfaEnabled,
    mfaSecret: user.mfaSecret,
    mfaBackupCodes: user.mfaBackupCodes,
    organizationIds: user.organizations.map((member) => member.organizationId)
  };
}

/**
 * Verify a submitted second-factor code for an MFA-enabled user. Accepts a TOTP code or a single-use
 * recovery code; a consumed recovery code is removed from the account. Returns true on success.
 * This performs the recovery-code side effect, so it must run exactly once per login — in `authorize`.
 */
export async function verifyMfaCode(user: CredentialUser, code: string): Promise<boolean> {
  if (!user.mfaEnabled || !user.mfaSecret) return false;

  const normalized = (code ?? "").trim();
  if (!normalized) return false;

  if (verifyTotp(user.mfaSecret, normalized)) return true;

  const remaining = consumeBackupCode(normalized, user.mfaBackupCodes);
  if (remaining) {
    await getPrisma().user.update({ where: { id: user.id }, data: { mfaBackupCodes: remaining } });
    return true;
  }

  return false;
}
