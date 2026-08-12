// DEV ONLY — prepare a coach-persona test account after it registers on the phone:
// marks the email verified (so login works without a real inbox) and grants an
// ACTIVE coach subscription (SUBSCRIBED tier, 20 AI interactions/day).
//
// Usage:
//   npx tsx scripts/dev-coach-test-account.ts runner+p2@example.test
//   npx tsx scripts/dev-coach-test-account.ts --all-prefix runner+   # every matching account
import { PrismaClient } from "@prisma/client";

/**
 * Refuse to run against anything but a local database.
 *
 * The previous guard was `NODE_ENV === "production"`, which fails OPEN: tsx does not set NODE_ENV,
 * so in normal use it is undefined and the check never fires. That left the only thing standing
 * between this script and real accounts as whichever DATABASE_URL happened to be in the environment
 * — and it verifies emails and grants free subscriptions, so pointing it at production would hand
 * out paid coach access and bypass email verification on live accounts.
 *
 * So the check is on the thing that actually matters: which database am I about to write to. An
 * ambient label describes intent; the connection string describes consequence.
 */
function assertLocalDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Refusing to guess.");

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a parseable URL. Refusing to run.");
  }

  const local = ["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "racedz_postgres"];
  if (!local.includes(host)) {
    throw new Error(
      `DATABASE_URL points at "${host}", which is not a local database. This script verifies emails ` +
        `and grants free subscriptions — refusing to run anywhere but localhost.`
    );
  }

  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production.");
}

/** Guards against a stray short prefix sweeping every account whose address happens to start with it. */
const MIN_PREFIX_LENGTH = 3;

async function prepare(prisma: PrismaClient, email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerifiedAt: true }
  });
  if (!user) {
    console.error(`✗ No user with email ${email} — register it in the app first.`);
    return false;
  }

  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }

  const active = await prisma.coachSubscription.findFirst({
    where: { userId: user.id, status: "ACTIVE", expiresAt: { gt: new Date() } }
  });
  if (!active) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    await prisma.coachSubscription.create({
      data: {
        userId: user.id,
        plan: "CUSTOM",
        status: "ACTIVE",
        months: 1,
        amountDa: 0,
        note: "dev persona field test — not a real payment",
        expiresAt
      }
    });
  }

  console.info(`✓ ${email}: verified + SUBSCRIBED until ${(active?.expiresAt ?? new Date(Date.now() + 30 * 86400_000)).toISOString().slice(0, 10)}`);
  return true;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) throw new Error("Pass an email, or --all-prefix <emailPrefix>.");
  assertLocalDatabase();

  const prisma = new PrismaClient();
  try {
    if (arg === "--all-prefix") {
      const prefix = process.argv[3];
      if (!prefix) throw new Error("Pass the email prefix after --all-prefix.");
      if (prefix.length < MIN_PREFIX_LENGTH) {
        throw new Error(`Prefix "${prefix}" is too broad — use at least ${MIN_PREFIX_LENGTH} characters.`);
      }
      const users = await prisma.user.findMany({
        where: { email: { startsWith: prefix } },
        select: { email: true }
      });
      if (users.length === 0) {
        console.error(`✗ No accounts starting with ${prefix}`);
        return;
      }
      console.info(`Preparing ${users.length} account(s) matching "${prefix}".`);
      for (const u of users) await prepare(prisma, u.email);
    } else {
      await prepare(prisma, arg.trim().toLowerCase());
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
