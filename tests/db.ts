// Direct DB access for E2E setup/assertions. Reads verification & reset tokens
// (which are emailed in real life) straight from the test database, and cleans up
// users created during a run. Requires DATABASE_URL pointed at the TEST database.
import { getPrisma } from "../src/lib/db";

const prisma = getPrisma();

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Put a seeded account past the one-time welcome screen for account-menu tests. */
export async function markUserOnboarded(email: string) {
  await prisma.user.update({ where: { email }, data: { onboardedAt: new Date() } });
}

/** Latest unused email-verification token for a user, or null. */
export async function latestEmailVerificationToken(userId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ token: string }>>`
    SELECT "token" FROM "EmailVerificationToken"
    WHERE "userId" = ${userId} AND "usedAt" IS NULL
    ORDER BY "expiresAt" DESC
    LIMIT 1`;
  return rows[0]?.token ?? null;
}

/** Latest unused password-reset token for a user, or null. */
export async function latestPasswordResetToken(userId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ token: string }>>`
    SELECT "token" FROM "PasswordResetToken"
    WHERE "userId" = ${userId} AND "usedAt" IS NULL
    ORDER BY "expiresAt" DESC
    LIMIT 1`;
  return rows[0]?.token ?? null;
}

/** Remove a user (and its tokens) created during a test. Safe if absent. */
export async function deleteUserByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  await prisma.$executeRaw`DELETE FROM "EmailVerificationToken" WHERE "userId" = ${user.id}`;
  await prisma.$executeRaw`DELETE FROM "PasswordResetToken" WHERE "userId" = ${user.id}`;
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {
    /* leave it if FKs (e.g. registrations) block deletion — test DB gets reset anyway */
  });
}

export async function closeDb() {
  await prisma.$disconnect();
}
