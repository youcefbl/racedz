// DEV ONLY — prepare a coach-persona test account after it registers on the phone:
// marks the email verified (so login works without a real inbox) and grants an
// ACTIVE coach subscription (SUBSCRIBED tier, 20 AI interactions/day).
//
// Usage:
//   npx tsx scripts/dev-coach-test-account.ts youcef+p2@gmail.com
//   npx tsx scripts/dev-coach-test-account.ts --all-prefix youcef+   # every matching account
import { PrismaClient } from "@prisma/client";

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
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in production.");

  const prisma = new PrismaClient();
  try {
    if (arg === "--all-prefix") {
      const prefix = process.argv[3];
      if (!prefix) throw new Error("Pass the email prefix after --all-prefix.");
      const users = await prisma.user.findMany({
        where: { email: { startsWith: prefix } },
        select: { email: true }
      });
      if (users.length === 0) {
        console.error(`✗ No accounts starting with ${prefix}`);
        return;
      }
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
