import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifications/email-provider";
import { renderRaceDzEmailHtml, renderRaceDzEmailText } from "@/lib/notifications/email-template";

type VerificationRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export async function createEmailVerificationToken(userId: string) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await getPrisma().$executeRaw`
    INSERT INTO "EmailVerificationToken" (
      "id",
      "userId",
      "token",
      "expiresAt"
    )
    VALUES (
      ${randomUUID()},
      ${userId},
      ${token},
      ${expiresAt}
    )
  `;

  return token;
}

export async function sendAccountVerificationEmail({
  to,
  firstName,
  token
}: {
  to: string;
  firstName: string;
  token: string;
}) {
  const url = new URL(`/verify-email/${token}`, getAppUrl()).toString();
  const body = `Hi ${firstName}, confirm your email to activate your ZidRun account and start registering for races.`;

  return sendNotificationEmail({
    to,
    subject: "Activate your ZidRun account",
    html: renderRaceDzEmailHtml({
      preheader: "Activate your ZidRun account.",
      title: "Activate your ZidRun account",
      body,
      action: {
        label: "Activate account",
        href: url
      },
      meta: [
        {
          label: "Valid for",
          value: "24 hours"
        }
      ]
    }),
    text: renderRaceDzEmailText({
      title: "Activate your ZidRun account",
      body,
      action: {
        label: "Activate account",
        href: url
      },
      meta: [
        {
          label: "Valid for",
          value: "24 hours"
        }
      ]
    })
  });
}

export async function verifyEmailToken(token: string) {
  const rows = await getPrisma().$queryRaw<VerificationRow[]>`
    SELECT "id", "userId", "expiresAt", "usedAt"
    FROM "EmailVerificationToken"
    WHERE "token" = ${token}
    LIMIT 1
  `;
  const verification = rows[0];

  if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
    return { ok: false as const };
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "User"
      SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW())
      WHERE "id" = ${verification.userId}
    `;
    await tx.$executeRaw`
      UPDATE "EmailVerificationToken"
      SET "usedAt" = NOW()
      WHERE "id" = ${verification.id}
    `;
  });

  return { ok: true as const };
}

export async function isEmailVerified(email: string) {
  const rows = await getPrisma().$queryRaw<Array<{ emailVerifiedAt: Date | null }>>`
    SELECT "emailVerifiedAt"
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;

  return Boolean(rows[0]?.emailVerifiedAt);
}

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003";
}
