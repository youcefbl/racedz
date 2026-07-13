import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { sendNotificationEmail } from "@/lib/notifications/email-provider";
import { renderRaceDzEmailHtml, renderRaceDzEmailText } from "@/lib/notifications/email-template";

type VerificationCopy = {
  subject: string;
  preheader: string;
  title: string;
  /** Uses {name} for the recipient's first name. */
  body: string;
  action: string;
  validForLabel: string;
  validForValue: string;
};

const VERIFICATION_COPY: Record<Locale, VerificationCopy> = {
  en: {
    subject: "Activate your ZidRun account",
    preheader: "Activate your ZidRun account.",
    title: "Activate your ZidRun account",
    body: "Hi {name}, confirm your email to activate your ZidRun account and start registering for races.",
    action: "Activate account",
    validForLabel: "Valid for",
    validForValue: "24 hours"
  },
  fr: {
    subject: "Activez votre compte ZidRun",
    preheader: "Activez votre compte ZidRun.",
    title: "Activez votre compte ZidRun",
    body: "Bonjour {name}, confirmez votre e-mail pour activer votre compte ZidRun et vous inscrire aux courses.",
    action: "Activer le compte",
    validForLabel: "Valable",
    validForValue: "24 heures"
  },
  ar: {
    subject: "فعّل حساب ZidRun الخاص بك",
    preheader: "فعّل حساب ZidRun الخاص بك.",
    title: "فعّل حساب ZidRun الخاص بك",
    body: "مرحباً {name}، أكّد بريدك الإلكتروني لتفعيل حساب ZidRun والبدء في التسجيل في السباقات.",
    action: "تفعيل الحساب",
    validForLabel: "صالح لمدة",
    validForValue: "24 ساعة"
  }
};

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
  token,
  locale = "en"
}: {
  to: string;
  firstName: string;
  token: string;
  locale?: Locale;
}) {
  const url = new URL(`/verify-email/${token}`, getAppUrl()).toString();
  const copy = VERIFICATION_COPY[locale] ?? VERIFICATION_COPY.en;
  const body = copy.body.replace("{name}", firstName);
  const action = { label: copy.action, href: url };
  const meta = [{ label: copy.validForLabel, value: copy.validForValue }];

  return sendNotificationEmail({
    to,
    subject: copy.subject,
    html: renderRaceDzEmailHtml({
      preheader: copy.preheader,
      title: copy.title,
      body,
      action,
      meta,
      locale
    }),
    text: renderRaceDzEmailText({
      title: copy.title,
      body,
      action,
      meta,
      locale
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
