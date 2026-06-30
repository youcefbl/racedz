import "server-only";

import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { renderRaceDzEmailHtml, renderRaceDzEmailText } from "@/lib/notifications/email-template";

// How long without a logged run before we nudge, how long a brand-new goal is left alone,
// and how long to wait between nudges so we never spam the same runner.
const INACTIVITY_DAYS = Number(process.env.COACH_INACTIVITY_DAYS) || 5;
const GRACE_DAYS = Number(process.env.COACH_INACTIVITY_GRACE_DAYS) || 5;
const NUDGE_COOLDOWN_DAYS = Number(process.env.COACH_INACTIVITY_COOLDOWN_DAYS) || 6;

type CoachLocale = "en" | "fr" | "ar";

type InactiveRunner = {
  userId: string;
  email: string;
  firstName: string;
  preferredLocale: CoachLocale;
  lastRunAt: Date | null;
};

const copy: Record<CoachLocale, { title: string; body: (name: string, days: number | null) => string; cta: string; preheader: string }> = {
  en: {
    title: "Time for your next run",
    body: (name, days) =>
      `Hi ${name}, ${days ? `it's been ${days} days since your last run.` : "you haven't logged a run yet."} ` +
      "Staying consistent keeps your stamina and protects your progress. A short easy run today is enough to keep momentum.",
    cta: "Open my coach",
    preheader: "A short run today keeps your stamina up."
  },
  fr: {
    title: "C'est l'heure de votre prochaine sortie",
    body: (name, days) =>
      `Bonjour ${name}, ${days ? `cela fait ${days} jours depuis votre dernière sortie.` : "vous n'avez pas encore enregistré de sortie."} ` +
      "La régularité entretient votre endurance et protège vos progrès. Une courte sortie facile aujourd'hui suffit à garder le rythme.",
    cta: "Ouvrir mon coach",
    preheader: "Une courte sortie aujourd'hui entretient votre endurance."
  },
  ar: {
    title: "حان وقت جريتك القادمة",
    body: (name, days) =>
      `مرحبا ${name}، ${days ? `مرّت ${days} أيام منذ آخر جري لك.` : "لم تسجّل أي جري بعد."} ` +
      "الانتظام يحافظ على لياقتك ويحمي تقدمك. جري خفيف قصير اليوم يكفي للحفاظ على الإيقاع.",
    cta: "افتح مدربي",
    preheader: "جري قصير اليوم يحافظ على لياقتك."
  }
};

/**
 * Find runners with an active coaching goal who have gone quiet and nudge them (in-app + push +
 * email, each respecting the runner's notification preferences) to stay active. Idempotent within
 * the cooldown window, so it is safe to run on a daily schedule. Returns how many were nudged.
 */
export async function nudgeInactiveRunners(): Promise<{ nudged: number; candidates: number }> {
  const prisma = getPrisma();

  const candidates = await prisma.$queryRaw<InactiveRunner[]>`
    SELECT
      u."id" AS "userId",
      u."email",
      u."firstName",
      g."preferredLocale",
      MAX(r."startedAt") AS "lastRunAt"
    FROM "RunnerGoal" g
    JOIN "User" u ON u."id" = g."userId"
    LEFT JOIN "RunnerRun" r ON r."userId" = u."id"
    WHERE g."status" = 'ACTIVE'
      AND u."blockedAt" IS NULL
      AND g."createdAt" < NOW() - (${GRACE_DAYS} * INTERVAL '1 day')
      AND NOT EXISTS (
        SELECT 1 FROM "Notification" n
        WHERE n."userId" = u."id"
          AND n."type" = 'RUNNER_INACTIVITY_NUDGE'
          AND n."createdAt" > NOW() - (${NUDGE_COOLDOWN_DAYS} * INTERVAL '1 day')
      )
    GROUP BY u."id", u."email", u."firstName", g."preferredLocale"
    HAVING MAX(r."startedAt") IS NULL OR MAX(r."startedAt") < NOW() - (${INACTIVITY_DAYS} * INTERVAL '1 day')
  `;

  const href = `${appUrl()}/account/coach`;
  let nudged = 0;

  for (const runner of candidates) {
    const locale: CoachLocale = (["en", "fr", "ar"] as const).includes(runner.preferredLocale) ? runner.preferredLocale : "en";
    const text = copy[locale];
    const name = runner.firstName?.trim() || (locale === "fr" ? "coureur" : locale === "ar" ? "العداء" : "runner");
    const days = runner.lastRunAt ? Math.floor((Date.now() - new Date(runner.lastRunAt).getTime()) / (24 * 60 * 60 * 1000)) : null;
    const body = text.body(name, days);

    try {
      await createNotification({
        userId: runner.userId,
        type: "RUNNER_INACTIVITY_NUDGE",
        title: text.title,
        body,
        href,
        channels: ["IN_APP", "EMAIL", "PUSH"],
        email: {
          to: runner.email,
          subject: text.title,
          html: renderRaceDzEmailHtml({ preheader: text.preheader, title: text.title, body, action: { label: text.cta, href } }),
          text: renderRaceDzEmailText({ title: text.title, body, action: { label: text.cta, href } })
        }
      });
      nudged += 1;
    } catch (error) {
      // One bad recipient must not abort the whole batch.
      console.error("Inactivity nudge failed", runner.userId, error);
    }
  }

  return { nudged, candidates: candidates.length };
}

function appUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003";
}
