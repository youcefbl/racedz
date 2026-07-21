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

/** Ensure the runner has an active coach subscription so the coach dashboard isn't gated behind the paywall. */
export async function ensureCoachSubscription(userId: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CoachSubscription" WHERE "userId" = ${userId} AND "status" = 'ACTIVE' AND "expiresAt" > NOW() LIMIT 1
  `;
  if (existing[0]) return;
  const expiresAt = new Date(Date.now() + 365 * 86_400_000);
  await prisma.$executeRaw`
    INSERT INTO "CoachSubscription" ("id", "userId", "plan", "status", "months", "expiresAt", "updatedAt")
    VALUES (gen_random_uuid(), ${userId}, 'YEARLY'::"CoachSubscriptionPlan", 'ACTIVE', 12, ${expiresAt}, NOW())
  `;
}

/** Ensure the runner has an active coach goal so the coach dashboard (and memory panel) renders. */
export async function ensureCoachGoal(userId: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "RunnerGoal" WHERE "userId" = ${userId} AND "status" = 'ACTIVE' LIMIT 1
  `;
  if (existing[0]) return existing[0].id;
  const targetDate = new Date(Date.now() + 70 * 86_400_000);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "RunnerGoal" (
      "id", "userId", "goalType", "targetDate", "targetDistanceKm", "targetTimeSeconds",
      "experienceLevel", "currentWeeklyDistanceKm", "availableTrainingDays", "preferredLongRunDay",
      "status", "updatedAt"
    ) VALUES (
      gen_random_uuid(), ${userId}, 'HALF_MARATHON'::"CoachGoalType", ${targetDate}, 21.1, 6600,
      'INTERMEDIATE'::"RunnerExperience", 38, ARRAY[0,1,2,4,6]::int[], 0, 'ACTIVE', NOW()
    ) RETURNING "id"
  `;
  return rows[0].id;
}

/** Seed coaching-memory rows for the visual/E2E memory-panel check. Clears any prior rows first. */
export async function seedCoachMemory(
  userId: string,
  rows: Array<{ kind: string; key: string; value: string; source: string; confidence?: number | null; ageDays?: number }>
) {
  await prisma.$executeRaw`DELETE FROM "CoachMemory" WHERE "userId" = ${userId}`;
  for (const row of rows) {
    const createdAt = new Date(Date.now() - (row.ageDays ?? 5) * 86_400_000);
    await prisma.$executeRaw`
      INSERT INTO "CoachMemory" ("id", "userId", "kind", "key", "value", "source", "confidence", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${userId}, ${row.kind}::"CoachMemoryKind", ${row.key}, ${row.value},
              ${row.source}::"CoachMemorySource", ${row.confidence ?? null}, 'ACTIVE', ${createdAt}, ${createdAt})
    `;
  }
}

export async function clearCoachMemory(userId: string) {
  await prisma.$executeRaw`DELETE FROM "CoachMemory" WHERE "userId" = ${userId}`;
}

export async function closeDb() {
  await prisma.$disconnect();
}
