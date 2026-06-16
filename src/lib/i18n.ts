export const LOCALES = ["en", "fr", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  ar: "AR"
};

export const dictionaries = {
  en: {
    nav: {
      races: "Races",
      organizers: "Organizers",
      admin: "Admin",
      findRace: "Find a Race",
      login: "Login"
    },
    home: {
      eyebrow: "RaceDZ",
      title: "Find your next race in Algeria.",
      subtitle: "Marathons, 10K races, trail runs, and community events all in one place.",
      findRace: "Find a Race",
      createEvent: "Create an Event",
      heroNote: "Next events opening across Algeria",
      upcomingEyebrow: "Upcoming races",
      upcomingTitle: "Open registrations",
      browseAll: "Browse all",
      raceTypesEyebrow: "Race types",
      raceTypesTitle: "Built for every runner",
      roadRaces: "Road races",
      trailRaces: "Trail races",
      marathons: "Marathons",
      kidsRaces: "Kids races",
      organizerTitle: "Are you organizing a race?",
      organizerText: "Create your event and manage registrations online with RaceDZ."
    },
    races: {
      eyebrow: "Race calendar",
      title: "Upcoming races in Algeria",
      emptyTitle: "No races found",
      emptyText: "Try changing the wilaya, distance, or race type."
    },
    search: {
      keyword: "Race, city, organizer",
      allWilayas: "All wilayas",
      allTypes: "All race types",
      anyDistance: "Any distance",
      anyStatus: "Any status",
      submit: "Search"
    },
    common: {
      view: "View"
    }
  },
  fr: {
    nav: {
      races: "Courses",
      organizers: "Organisateurs",
      admin: "Admin",
      findRace: "Trouver une course",
      login: "Connexion"
    },
    home: {
      eyebrow: "RaceDZ",
      title: "Trouvez votre prochaine course en Algerie.",
      subtitle: "Marathons, 10K, trails et evenements communautaires au meme endroit.",
      findRace: "Trouver une course",
      createEvent: "Creer un evenement",
      heroNote: "Prochains evenements ouverts en Algerie",
      upcomingEyebrow: "Courses a venir",
      upcomingTitle: "Inscriptions ouvertes",
      browseAll: "Tout parcourir",
      raceTypesEyebrow: "Types de courses",
      raceTypesTitle: "Pour tous les coureurs",
      roadRaces: "Courses sur route",
      trailRaces: "Trails",
      marathons: "Marathons",
      kidsRaces: "Courses enfants",
      organizerTitle: "Vous organisez une course ?",
      organizerText: "Creez votre evenement et gerez les inscriptions en ligne avec RaceDZ."
    },
    races: {
      eyebrow: "Calendrier des courses",
      title: "Courses a venir en Algerie",
      emptyTitle: "Aucune course trouvee",
      emptyText: "Essayez de changer la wilaya, la distance ou le type de course."
    },
    search: {
      keyword: "Course, ville, organisateur",
      allWilayas: "Toutes les wilayas",
      allTypes: "Tous les types",
      anyDistance: "Toute distance",
      anyStatus: "Tout statut",
      submit: "Rechercher"
    },
    common: {
      view: "Voir"
    }
  },
  ar: {
    nav: {
      races: "السباقات",
      organizers: "المنظمون",
      admin: "الإدارة",
      findRace: "ابحث عن سباق",
      login: "تسجيل الدخول"
    },
    home: {
      eyebrow: "RaceDZ",
      title: "اكتشف سباقك القادم في الجزائر.",
      subtitle: "ماراثون، 10 كلم، ترايل وسباقات محلية في مكان واحد.",
      findRace: "ابحث عن سباق",
      createEvent: "أنشئ سباقا",
      heroNote: "أحداث قادمة في الجزائر",
      upcomingEyebrow: "سباقات قادمة",
      upcomingTitle: "التسجيلات المفتوحة",
      browseAll: "عرض الكل",
      raceTypesEyebrow: "أنواع السباقات",
      raceTypesTitle: "لكل العدائين",
      roadRaces: "سباقات الطريق",
      trailRaces: "سباقات الترايل",
      marathons: "ماراثون",
      kidsRaces: "سباقات الأطفال",
      organizerTitle: "هل تنظم سباقا؟",
      organizerText: "أنشئ سباقك وقم بإدارة التسجيلات عبر RaceDZ."
    },
    races: {
      eyebrow: "رزنامة السباقات",
      title: "السباقات القادمة في الجزائر",
      emptyTitle: "لا توجد سباقات",
      emptyText: "جرّب تغيير الولاية أو المسافة أو نوع السباق."
    },
    search: {
      keyword: "سباق، مدينة، منظم",
      allWilayas: "كل الولايات",
      allTypes: "كل الأنواع",
      anyDistance: "أي مسافة",
      anyStatus: "أي حالة",
      submit: "بحث"
    },
    common: {
      view: "عرض"
    }
  }
} as const;

export function getLocale(value?: string | string[] | null): Locale {
  const locale = Array.isArray(value) ? value[0] : value;
  return LOCALES.includes(locale as Locale) ? (locale as Locale) : "en";
}

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export function withLocale(href: string, locale: Locale) {
  if (locale === "en") {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}lang=${locale}`;
}
