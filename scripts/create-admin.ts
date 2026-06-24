// Securely create or promote a RaceDZ superadmin for production.
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run admin:create
// Never deploy the demo seed accounts to production — use this instead.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() || "RaceDZ";
  const lastName = process.env.ADMIN_LAST_NAME?.trim() || "Admin";

  if (!email) throw new Error("Set ADMIN_EMAIL.");
  if (password.length < 8) throw new Error("Set ADMIN_PASSWORD (at least 8 characters).");

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "SUPERADMIN", passwordHash, emailVerifiedAt: new Date() },
      create: { email, passwordHash, firstName, lastName, role: "SUPERADMIN", emailVerifiedAt: new Date() }
    });
    console.info(`✅ Superadmin ready: ${user.email} (verified, can log in now).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
