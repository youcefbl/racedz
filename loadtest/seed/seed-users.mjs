// Seed N verified RUNNER accounts for load testing, idempotently (re-runnable).
//
// Sets emailVerifiedAt (isEmailVerified() in src/lib/email-verification.ts gates
// login on it) and a bcrypt passwordHash matching users-spec.mjs, so the cookie
// harvester can log every account in.
//
// Run from the repo root against the STAGING db:
//   DATABASE_URL=postgresql://racedz:PW@127.0.0.1:5433/racedz \
//     node loadtest/seed/seed-users.mjs
//
// Uses the repo's own @prisma/client + bcryptjs (already installed).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { COUNT, PASSWORD, emailFor, pad } from "./users-spec.mjs";

const prisma = new PrismaClient();
const BATCH = 100;

async function main() {
  const url = process.env.DATABASE_URL || "";
  // Guard rail: refuse anything that smells like production unless forced.
  if (/prod/i.test(url) && process.env.I_KNOW_ITS_PROD !== "1") {
    throw new Error("DATABASE_URL looks like production. Refusing. Set I_KNOW_ITS_PROD=1 to override.");
  }
  if (!url) throw new Error("DATABASE_URL is not set.");

  console.log(`Seeding ${COUNT} users into ${url.replace(/:[^:@/]+@/, ":****@")}`);
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  let done = 0;
  for (let start = 1; start <= COUNT; start += BATCH) {
    const end = Math.min(start + BATCH - 1, COUNT);
    const ops = [];
    for (let i = start; i <= end; i++) {
      const email = emailFor(i);
      ops.push(
        prisma.user.upsert({
          where: { email },
          update: { passwordHash: hash, emailVerifiedAt: now, blockedAt: null },
          create: {
            email,
            firstName: "Load",
            lastName: `Test${pad(i)}`,
            passwordHash: hash,
            role: "RUNNER",
            emailVerifiedAt: now,
            language: "en"
          }
        })
      );
    }
    await prisma.$transaction(ops);
    done += ops.length;
    console.log(`  seeded ${done}/${COUNT}`);
  }

  console.log("Done. Delete later with:");
  console.log(`  DELETE FROM "User" WHERE email LIKE '${process.env.TEST_USER_PREFIX || "loadtest"}+%@${process.env.TEST_USER_DOMAIN || "zidrun.test"}';`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
