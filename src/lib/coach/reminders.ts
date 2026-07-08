import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveCoachEntitlement } from "@/lib/coach/entitlement";
import { ensureCurrentWeekPlan } from "@/lib/coach/service";
import { fetchForecastConditions, resolveCoordinates } from "@/lib/coach/weather";
import { localizeWorkout } from "@/lib/coach/workout-i18n";
import type { CoachWorkout } from "@/lib/coach/schemas";
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

// ---------------------------------------------------------------------------
// Daily "don't forget your run today" reminder.
// ---------------------------------------------------------------------------

// A runner who has a run planned for today, plus what they need to see: the workout to do, their
// wilaya (for a local weather note) and locale.
type TodaysWorkoutRunner = {
  userId: string;
  email: string;
  firstName: string;
  wilaya: string | null;
  preferredLocale: CoachLocale;
  title: string;
  workoutType: string;
  targetDistanceKm: number | null;
  targetDurationMin: number | null;
  intensity: string;
  instructions: string;
};

// Localized fragments assembled into the reminder body. Kept as small pieces so the message stays
// natural in each language while the dynamic parts (target, weather) are filled in per runner.
const reminderCopy: Record<
  CoachLocale,
  {
    title: string;
    intro: (name: string) => string;
    target: (detail: string) => string;
    weather: (highC: number) => string;
    weatherHot: string;
    weatherRain: string;
    fuel: string;
    askCoach: string;
    cta: string;
    preheader: string;
  }
> = {
  en: {
    title: "Don't forget your run today 🏃",
    intro: (name) => `Hi ${name}, you have a run on your plan today.`,
    target: (detail) => `Today's session: ${detail}.`,
    weather: (highC) => `Where you run it should reach about ${highC}°C today.`,
    weatherHot: "It's going to be hot — run early or after sunset and carry extra water.",
    weatherRain: "Rain is likely, so plan your timing and dress for it.",
    fuel: "Hydrate well through the day and eat something light a couple of hours before you head out.",
    askCoach: "Any questions about today's session? Ask your coach in the app.",
    cta: "Open my coach",
    preheader: "Your run for today, the weather, and how to fuel it."
  },
  fr: {
    title: "N'oubliez pas votre sortie aujourd'hui 🏃",
    intro: (name) => `Bonjour ${name}, votre plan prévoit une sortie aujourd'hui.`,
    target: (detail) => `Séance du jour : ${detail}.`,
    weather: (highC) => `Là où vous courez, il devrait faire environ ${highC}°C aujourd'hui.`,
    weatherHot: "Il va faire chaud — courez tôt ou après le coucher du soleil et emportez de l'eau.",
    weatherRain: "De la pluie est probable, prévoyez votre horaire et habillez-vous en conséquence.",
    fuel: "Hydratez-vous bien dans la journée et mangez léger une à deux heures avant de partir.",
    askCoach: "Des questions sur la séance du jour ? Demandez à votre coach dans l'application.",
    cta: "Ouvrir mon coach",
    preheader: "Votre sortie du jour, la météo et comment vous préparer."
  },
  ar: {
    title: "لا تنسَ جريتك اليوم 🏃",
    intro: (name) => `مرحبا ${name}، لديك جري مبرمج في خطتك اليوم.`,
    target: (detail) => `حصة اليوم: ${detail}.`,
    weather: (highC) => `في المكان الذي تجري فيه ستصل الحرارة إلى حوالي ${highC}° اليوم.`,
    weatherHot: "سيكون الجو حاراً — اجرِ باكراً أو بعد الغروب واحمل ماءً إضافياً.",
    weatherRain: "الأمطار محتملة، فخطّط لتوقيتك وارتدِ ما يناسب.",
    fuel: "اشرب الماء جيداً خلال اليوم وتناول وجبة خفيفة قبل ساعة أو ساعتين من الخروج.",
    askCoach: "هل لديك أسئلة عن حصة اليوم؟ اسأل مدربك في التطبيق.",
    cta: "افتح مدربي",
    preheader: "جريتك اليوم، حالة الطقس، وكيف تستعد لها."
  }
};

/**
 * Remind runners who have a run scheduled for today (a PLANNED, non-REST workout on their ACTIVE
 * plan) not to skip it — with the target, a local weather note, fuelling advice, and a nudge to
 * ask their coach. Only subscribed / trial runners are reminded. Idempotent per day (dedupes on a
 * same-day TRAINING_REMINDER notification), so it is safe to run daily and safe to re-run.
 */
export async function remindTodaysWorkouts(): Promise<{ reminded: number; candidates: number }> {
  const prisma = getPrisma();

  // One reminder per runner: the earliest non-rest workout planned for today, on an active plan,
  // for a non-blocked user who hasn't already been reminded today.
  const candidates = await prisma.$queryRaw<TodaysWorkoutRunner[]>`
    SELECT DISTINCT ON (u."id")
      u."id" AS "userId", u."email", u."firstName", u."wilaya",
      COALESCE(g."preferredLocale", 'en') AS "preferredLocale",
      w."title", w."workoutType"::text AS "workoutType",
      w."targetDistanceKm", w."targetDurationMin", w."intensity", w."instructions"
    FROM "TrainingWorkout" w
    JOIN "TrainingPlan" plan ON plan."id" = w."trainingPlanId" AND plan."status" = 'ACTIVE'
    JOIN "User" u ON u."id" = plan."userId"
    JOIN "RunnerGoal" g ON g."id" = plan."goalId"
    WHERE w."status" = 'PLANNED'
      AND w."workoutType"::text <> 'REST'
      AND w."scheduledFor"::date = CURRENT_DATE
      AND u."blockedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Notification" n
        WHERE n."userId" = u."id" AND n."type" = 'TRAINING_REMINDER'
          AND n."createdAt" >= CURRENT_DATE
      )
    ORDER BY u."id", w."scheduledFor" ASC
  `;

  const href = `${appUrl()}/account/coach`;
  let reminded = 0;

  for (const runner of candidates) {
    try {
      // Only coached runners (subscribed or on their free trial) get the reminder.
      const entitlement = await resolveCoachEntitlement(runner.userId);
      if (entitlement.tier === "NONE") continue;

      const locale: CoachLocale = (["en", "fr", "ar"] as const).includes(runner.preferredLocale) ? runner.preferredLocale : "en";
      const text = reminderCopy[locale];
      const name = runner.firstName?.trim() || (locale === "fr" ? "coureur" : locale === "ar" ? "العداء" : "runner");

      // Translate the fixed workout strings, then describe the target (title + distance/duration).
      const workout: CoachWorkout = {
        scheduledFor: new Date().toISOString(),
        workoutType: runner.workoutType as CoachWorkout["workoutType"],
        title: runner.title,
        targetDistanceKm: runner.targetDistanceKm,
        targetDurationMin: runner.targetDurationMin,
        intensity: runner.intensity,
        instructions: runner.instructions
      };
      const localized = localizeWorkout(workout, locale);
      const metric =
        runner.targetDistanceKm != null
          ? `${runner.targetDistanceKm} km`
          : runner.targetDurationMin != null
            ? `${runner.targetDurationMin} min`
            : null;
      const detail = metric ? `${localized.title} · ${metric}` : localized.title;

      const parts = [text.intro(name), text.target(detail)];
      const weatherLine = await buildWeatherLine(runner.wilaya, text);
      if (weatherLine) parts.push(weatherLine);
      parts.push(text.fuel, text.askCoach);
      const body = parts.join(" ");

      await createNotification({
        userId: runner.userId,
        type: "TRAINING_REMINDER",
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
      reminded += 1;
    } catch (error) {
      // One bad recipient must not abort the whole batch.
      console.error("Training reminder failed", runner.userId, error);
    }
  }

  return { reminded, candidates: candidates.length };
}

// A localized one-line weather note for the runner's wilaya, or null when weather is unavailable
// (disabled, no location, or the provider is slow). Never throws — the reminder sends without it.
async function buildWeatherLine(
  wilaya: string | null,
  text: (typeof reminderCopy)[CoachLocale]
): Promise<string | null> {
  try {
    const coordinates = resolveCoordinates({ wilaya });
    if (!coordinates) return null;
    const forecast = await fetchForecastConditions(coordinates);
    if (!forecast || forecast.todayHighC == null) return null;
    const high = Math.round(forecast.todayHighC);
    let line = text.weather(high);
    if (high >= 30) line += ` ${text.weatherHot}`;
    else if ((forecast.precipitationChancePct ?? 0) >= 40) line += ` ${text.weatherRain}`;
    return line;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Weekly plan auto-rollover: generate next week when the current one has ended.
// ---------------------------------------------------------------------------

type PlanRolloverRunner = {
  userId: string;
  email: string;
  firstName: string;
  preferredLocale: CoachLocale;
};

const planReadyCopy: Record<CoachLocale, { title: string; body: (name: string) => string; cta: string; preheader: string }> = {
  en: {
    title: "Your new training week is ready",
    body: (name) =>
      `Hi ${name}, your previous plan wrapped up, so we've generated your next week automatically — starting today. ` +
      "Open the coach to see this week's runs, and ask your coach any time if you want to adjust it.",
    cta: "See this week's plan",
    preheader: "Your next training week has been generated automatically."
  },
  fr: {
    title: "Votre nouvelle semaine d'entraînement est prête",
    body: (name) =>
      `Bonjour ${name}, votre plan précédent est terminé, nous avons donc généré votre semaine suivante automatiquement — à partir d'aujourd'hui. ` +
      "Ouvrez le coach pour voir les séances de la semaine, et demandez-lui à tout moment pour l'ajuster.",
    cta: "Voir le plan de la semaine",
    preheader: "Votre prochaine semaine d'entraînement a été générée automatiquement."
  },
  ar: {
    title: "أسبوع تدريبك الجديد جاهز",
    body: (name) =>
      `مرحبا ${name}، انتهت خطتك السابقة، لذا أنشأنا أسبوعك التالي تلقائياً — بدءاً من اليوم. ` +
      "افتح المدرب لرؤية حصص هذا الأسبوع، واسأل مدربك في أي وقت إذا أردت تعديلها.",
    cta: "عرض خطة الأسبوع",
    preheader: "تم إنشاء أسبوع تدريبك التالي تلقائياً."
  }
};

/**
 * Keep every coached runner's plan rolling: for anyone whose active plan's week has ended (and who
 * has no pending draft to accept), generate and activate the next week from the deterministic
 * skeleton, then notify them. Only runners who already use plans and are subscribed/on trial are
 * rolled over. Idempotent — a runner already covered this week is skipped. Meant to run daily,
 * before the training reminder, so today's run exists when the reminder fires.
 */
export async function rolloverTrainingPlans(): Promise<{ generated: number; candidates: number }> {
  const prisma = getPrisma();

  const candidates = await prisma.$queryRaw<PlanRolloverRunner[]>`
    SELECT u."id" AS "userId", u."email", u."firstName", COALESCE(g."preferredLocale", 'en') AS "preferredLocale"
    FROM "RunnerGoal" g
    JOIN "User" u ON u."id" = g."userId"
    WHERE g."status" = 'ACTIVE'
      AND u."blockedAt" IS NULL
      AND EXISTS (SELECT 1 FROM "TrainingPlan" p0 WHERE p0."goalId" = g."id")
      AND NOT EXISTS (
        SELECT 1 FROM "TrainingPlan" p
        WHERE p."goalId" = g."id"
          AND ((p."status" = 'ACTIVE' AND p."endsOn" >= CURRENT_DATE) OR p."status" = 'DRAFT')
      )
  `;

  const href = `${appUrl()}/account/coach`;
  let generated = 0;

  for (const runner of candidates) {
    try {
      // Only coached runners (subscribed or on their free trial) get an auto-rolled plan.
      const entitlement = await resolveCoachEntitlement(runner.userId);
      if (entitlement.tier === "NONE") continue;

      const result = await ensureCurrentWeekPlan(runner.userId);
      if (!result.created) continue;

      const locale: CoachLocale = (["en", "fr", "ar"] as const).includes(runner.preferredLocale) ? runner.preferredLocale : "en";
      const text = planReadyCopy[locale];
      const name = runner.firstName?.trim() || (locale === "fr" ? "coureur" : locale === "ar" ? "العداء" : "runner");
      const body = text.body(name);

      await createNotification({
        userId: runner.userId,
        type: "TRAINING_PLAN_READY",
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
      generated += 1;
    } catch (error) {
      // One runner's failure must not abort the batch.
      console.error("Plan rollover failed", runner.userId, error);
    }
  }

  return { generated, candidates: candidates.length };
}

function appUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003";
}
