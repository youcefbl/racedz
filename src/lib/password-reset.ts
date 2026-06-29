import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifications/email-provider";
import { renderRaceDzEmailHtml, renderRaceDzEmailText } from "@/lib/notifications/email-template";

type ResetRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export async function createPasswordResetToken(userId: string) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await getPrisma().$executeRaw`
    INSERT INTO "PasswordResetToken" ("id", "userId", "token", "expiresAt")
    VALUES (${randomUUID()}, ${userId}, ${token}, ${expiresAt})
  `;

  return token;
}

export async function sendPasswordResetEmail({ to, firstName, token }: { to: string; firstName: string; token: string }) {
  const url = new URL(`/reset-password/${token}`, getAppUrl()).toString();
  const body = `Hi ${firstName}, we received a request to reset your ZidRun password. Use the button below to choose a new one. If you didn't request this, you can safely ignore this email.`;

  return sendNotificationEmail({
    to,
    subject: "Reset your ZidRun password",
    html: renderRaceDzEmailHtml({
      preheader: "Reset your ZidRun password.",
      title: "Reset your password",
      body,
      action: { label: "Reset password", href: url },
      meta: [{ label: "Valid for", value: "1 hour" }]
    }),
    text: renderRaceDzEmailText({
      title: "Reset your password",
      body,
      action: { label: "Reset password", href: url },
      meta: [{ label: "Valid for", value: "1 hour" }]
    })
  });
}

/** Returns whether the token is currently valid (unused + unexpired), without consuming it. */
export async function isValidPasswordResetToken(token: string) {
  const rows = await getPrisma().$queryRaw<ResetRow[]>`
    SELECT "id", "userId", "expiresAt", "usedAt"
    FROM "PasswordResetToken"
    WHERE "token" = ${token}
    LIMIT 1
  `;
  const reset = rows[0];
  return Boolean(reset && !reset.usedAt && reset.expiresAt >= new Date());
}

/** Consume a reset token and set the new password hash. Returns ok=false if the token is invalid. */
export async function consumePasswordResetToken(token: string, passwordHash: string) {
  const rows = await getPrisma().$queryRaw<ResetRow[]>`
    SELECT "id", "userId", "expiresAt", "usedAt"
    FROM "PasswordResetToken"
    WHERE "token" = ${token}
    LIMIT 1
  `;
  const reset = rows[0];

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return { ok: false as const };
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "User" SET "passwordHash" = ${passwordHash} WHERE "id" = ${reset.userId}
    `;
    await tx.$executeRaw`
      UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "id" = ${reset.id}
    `;
    // Any other outstanding reset tokens for this user are now stale.
    await tx.$executeRaw`
      UPDATE "PasswordResetToken" SET "usedAt" = NOW()
      WHERE "userId" = ${reset.userId} AND "usedAt" IS NULL
    `;
  });

  return { ok: true as const };
}

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003";
}
