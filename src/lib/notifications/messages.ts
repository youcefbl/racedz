import { getLocale, type Locale } from "@/lib/i18n";

// Localized copy for the fixed-string notification builders in src/lib/notifications.ts.
// Recipients receive each notification (in-app title/body, push, and email chrome) in the
// language they picked (User.language), falling back to English. Free-text pieces authored by
// a human — organizer announcements, admin support-chat previews, and the change summary — are
// passed through untranslated; only the app-owned surrounding copy is localized here.

// Reuse the app's locale normalizer: any string / null → a valid Locale (en fallback).
export const resolveRecipientLocale = getLocale;

type Localized<T> = Record<Locale, T>;

function t<T>(locale: Locale, table: Localized<T>): T {
  return table[locale];
}

// Shared email chrome (button labels, meta-row labels) used across several builders.
const emailChrome: Localized<{
  openApp: string;
  viewRace: string;
  viewRegistration: string;
  race: string;
  category: string;
  changes: string;
  detailsUpdated: string;
}> = {
  en: {
    openApp: "Open ZidRun",
    viewRace: "View race",
    viewRegistration: "View registration",
    race: "Race",
    category: "Category",
    changes: "Changes",
    detailsUpdated: "Details updated"
  },
  fr: {
    openApp: "Ouvrir ZidRun",
    viewRace: "Voir la course",
    viewRegistration: "Voir l'inscription",
    race: "Course",
    category: "Catégorie",
    changes: "Modifications",
    detailsUpdated: "Détails mis à jour"
  },
  ar: {
    openApp: "فتح ZidRun",
    viewRace: "عرض السباق",
    viewRegistration: "عرض التسجيل",
    race: "السباق",
    category: "الفئة",
    changes: "التغييرات",
    detailsUpdated: "تم تحديث التفاصيل"
  }
};

export function emailLabels(locale: Locale) {
  return t(locale, emailChrome);
}

// Fallback used for the sender's name when a runner has no display name yet.
const aRunner: Localized<string> = { en: "A runner", fr: "Un coureur", ar: "أحد العدّائين" };

export function racePendingReviewMessage(
  locale: Locale,
  { organizationName, raceTitle }: { organizationName: string; raceTitle: string }
) {
  return t(locale, {
    en: {
      title: "Race approval pending",
      body: `${organizationName} submitted "${raceTitle}" for review.`
    },
    fr: {
      title: "Course en attente d'approbation",
      body: `${organizationName} a soumis « ${raceTitle} » pour examen.`
    },
    ar: {
      title: "سباق بانتظار الموافقة",
      body: `قدّم ${organizationName} السباق «${raceTitle}» للمراجعة.`
    }
  });
}

export function coachSubscriptionRequestMessage(locale: Locale, { runnerName }: { runnerName: string }) {
  const runner = runnerName || aRunner[locale];
  return t(locale, {
    en: {
      title: "Coach payment to review",
      body: `${runner} submitted a coach subscription payment for review.`
    },
    fr: {
      title: "Paiement coach à vérifier",
      body: `${runner} a soumis un paiement d'abonnement coach à vérifier.`
    },
    ar: {
      title: "دفع اشتراك الكوتش للمراجعة",
      body: `قدّم ${runner} دفعة اشتراك الكوتش للمراجعة.`
    }
  });
}

export function supportMessageMessage(
  locale: Locale,
  { runnerName, preview }: { runnerName: string; preview: string }
) {
  const runner = runnerName || aRunner[locale];
  const title = t(locale, {
    en: "New support message",
    fr: "Nouveau message d'assistance",
    ar: "رسالة دعم جديدة"
  });
  // The preview is the runner's own words — passed through untranslated.
  return { title, body: `${runner}: ${preview}` };
}

export function supportReplyMessage(locale: Locale, { preview }: { preview: string }) {
  const title = t(locale, {
    en: "ZidRun support replied",
    fr: "L'assistance ZidRun a répondu",
    ar: "ردّ فريق دعم ZidRun"
  });
  // The reply preview is the support team's own words — passed through untranslated.
  return { title, body: preview };
}

export function organizerRaceStatusMessage(
  locale: Locale,
  { raceTitle, status }: { raceTitle: string; status: "PUBLISHED" | "REJECTED" | "UNPUBLISHED" }
) {
  const tables: Record<"PUBLISHED" | "REJECTED" | "UNPUBLISHED", Localized<{ title: string; body: string }>> = {
    PUBLISHED: {
      en: { title: "Race published", body: `"${raceTitle}" is now published on ZidRun.` },
      fr: { title: "Course publiée", body: `« ${raceTitle} » est désormais publiée sur ZidRun.` },
      ar: { title: "تم نشر السباق", body: `أصبح «${raceTitle}» منشوراً الآن على ZidRun.` }
    },
    REJECTED: {
      en: { title: "Race rejected", body: `"${raceTitle}" was rejected by the ZidRun admin team.` },
      fr: { title: "Course refusée", body: `« ${raceTitle} » a été refusée par l'équipe ZidRun.` },
      ar: { title: "تم رفض السباق", body: `تم رفض «${raceTitle}» من قبل فريق ZidRun.` }
    },
    UNPUBLISHED: {
      en: { title: "Race unpublished", body: `"${raceTitle}" was unpublished by the ZidRun admin team.` },
      fr: { title: "Course dépubliée", body: `« ${raceTitle} » a été retirée par l'équipe ZidRun.` },
      ar: { title: "تم إلغاء نشر السباق", body: `تم إلغاء نشر «${raceTitle}» من قبل فريق ZidRun.` }
    }
  };
  return t(locale, tables[status]);
}

export function raceRegistrationCreatedMessage(
  locale: Locale,
  { raceTitle, categoryName }: { raceTitle: string; categoryName: string }
) {
  return t(locale, {
    en: {
      title: "Race registration received",
      body: `Your registration for "${raceTitle}" (${categoryName}) was created.`,
      emailTitle: "Registration received",
      subject: `Registration received: ${raceTitle}`,
      preheader: `Your ZidRun registration for ${raceTitle} was created.`
    },
    fr: {
      title: "Inscription à la course reçue",
      body: `Votre inscription à « ${raceTitle} » (${categoryName}) a été créée.`,
      emailTitle: "Inscription reçue",
      subject: `Inscription reçue : ${raceTitle}`,
      preheader: `Votre inscription ZidRun à ${raceTitle} a été créée.`
    },
    ar: {
      title: "تم استلام التسجيل في السباق",
      body: `تم إنشاء تسجيلك في «${raceTitle}» (${categoryName}).`,
      emailTitle: "تم استلام التسجيل",
      subject: `تم استلام التسجيل: ${raceTitle}`,
      preheader: `تم إنشاء تسجيلك في ZidRun للسباق ${raceTitle}.`
    }
  });
}

export function raceChangedMessage(locale: Locale, { raceTitle }: { raceTitle: string }) {
  return t(locale, {
    en: { title: "Race details updated", subject: `Race update: ${raceTitle}` },
    fr: { title: "Détails de la course mis à jour", subject: `Mise à jour de la course : ${raceTitle}` },
    ar: { title: "تم تحديث تفاصيل السباق", subject: `تحديث السباق: ${raceTitle}` }
  });
}

export function newFollowerMessage(locale: Locale, { followerName }: { followerName: string }) {
  const name = followerName || aRunner[locale];
  return t(locale, {
    en: { title: "New follower", body: `${name} started following you.` },
    fr: { title: "Nouvel abonné", body: `${name} vous suit désormais.` },
    ar: { title: "متابع جديد", body: `بدأ ${name} بمتابعتك.` }
  });
}

export function runKudosMessage(locale: Locale, { actorName }: { actorName: string }) {
  const name = actorName || aRunner[locale];
  return t(locale, {
    en: { title: "Kudos on your run", body: `${name} gave kudos to your run.` },
    fr: { title: "Kudos sur votre course", body: `${name} a donné un kudos à votre course.` },
    ar: { title: "تحية على جريك", body: `منح ${name} تحية لجريك.` }
  });
}

// A saved race result. FINISHED carries the finish time; the other statuses are reported with a
// localized label instead (the time is always null for them).
export function raceResultMessage(
  locale: Locale,
  {
    raceTitle,
    status,
    finishTime
  }: { raceTitle: string; status: "FINISHED" | "DNF" | "DNS" | "DSQ"; finishTime: string | null }
) {
  const statusLabels: Record<"DNF" | "DNS" | "DSQ", Localized<string>> = {
    DNF: { en: "DNF (did not finish)", fr: "abandon (DNF)", ar: "لم يُكمل (DNF)" },
    DNS: { en: "DNS (did not start)", fr: "non partant (DNS)", ar: "لم يبدأ (DNS)" },
    DSQ: { en: "DSQ (disqualified)", fr: "disqualifié (DSQ)", ar: "مُستبعد (DSQ)" }
  };

  const title = t(locale, {
    en: "Race result published",
    fr: "Résultat de course publié",
    ar: "تم نشر نتيجة السباق"
  });

  if (status === "FINISHED" && finishTime) {
    return {
      title,
      body: t(locale, {
        en: `Your result for "${raceTitle}" is in: ${finishTime}.`,
        fr: `Votre résultat pour « ${raceTitle} » est disponible : ${finishTime}.`,
        ar: `نتيجتك في «${raceTitle}» أصبحت متاحة: ${finishTime}.`
      })
    };
  }

  if (status === "FINISHED") {
    return {
      title,
      body: t(locale, {
        en: `Your result for "${raceTitle}" was recorded as finished.`,
        fr: `Votre résultat pour « ${raceTitle} » a été enregistré : terminé.`,
        ar: `تم تسجيل نتيجتك في «${raceTitle}»: أكملت السباق.`
      })
    };
  }

  const label = t(locale, statusLabels[status]);
  return {
    title,
    body: t(locale, {
      en: `Your result for "${raceTitle}" was recorded as ${label}.`,
      fr: `Votre résultat pour « ${raceTitle} » a été enregistré : ${label}.`,
      ar: `تم تسجيل نتيجتك في «${raceTitle}»: ${label}.`
    })
  };
}
