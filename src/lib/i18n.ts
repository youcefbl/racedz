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
      about: "About",
      contact: "Contact",
      terms: "Terms",
      privacy: "Privacy",
      findRace: "Find a Race",
      login: "Login",
      openMenu: "Open menu",
      closeMenu: "Close menu"
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
      resultCount: "{count} races found",
      clearFilters: "Clear filters",
      emptyTitle: "No races found",
      emptyText: "Try changing the wilaya, distance, or race type."
    },
    raceDetail: {
      registrationCloses: "Registration closes {date}",
      placesAvailable: "{available} of {total} places available",
      registerNow: "Register Now",
      registrationClosed: "Registration is {status}.",
      categoriesTitle: "Distances and categories",
      elevationGain: "{meters}m elevation gain",
      cutoffTime: "{hours}h cut-off",
      rulesTitle: "Race rules",
      noRules: "Rules will be published by the organizer.",
      documentsTitle: "Required documents",
      noDocuments: "No required documents listed yet.",
      contactTitle: "Contact",
      organizerLabel: "Organizer"
    },
    pages: {
      about: {
        title: "About RaceDZ",
        intro:
          "RaceDZ is the simplest way to discover, publish, and register for running races across Algeria. We connect runners with road races, trail runs, marathons, and community events in one searchable place.",
        runnersTitle: "For runners",
        runnersText:
          "Browse upcoming events, filter by wilaya, distance, and race type, and register in minutes. Track your registrations from your account dashboard.",
        organizersTitle: "For organizers",
        organizersText:
          "Request organizer access, publish your race, manage categories and pricing, invite your team, and keep track of participants with exportable lists.",
        adminsTitle: "For admins",
        adminsText:
          "Admins and superadmins review organizations and races, manage user roles, and keep the platform safe through an audit log and approval workflow."
      },
      organizers: {
        eyebrow: "For organizers",
        title: "Publish races and manage participants with less manual work.",
        intro:
          "RaceDZ gives clubs, associations, and event teams one place to publish race details, manage categories, invite teammates, and track registrations.",
        primaryCta: "Request organizer access",
        secondaryCta: "Browse races",
        dashboardCta: "Open organizer dashboard",
        reviewNote: "Organizer access is reviewed before races can be published publicly.",
        workflowTitle: "What organizers can do",
        publishTitle: "Create race events",
        publishText: "Add race dates, locations, categories, distances, pricing, capacity, rules, and race images.",
        registrationsTitle: "Manage registrations",
        registrationsText: "Track runners, payment status, participant status, and export registration lists for race operations.",
        teamTitle: "Invite your team",
        teamText: "Add organization members, assign roles, resend invites, and revoke pending access when plans change.",
        updatesTitle: "Communicate changes",
        updatesText: "Publish announcements and notify registered runners when important race details change."
      },
      contact: {
        title: "Contact us",
        intro: "Have a question about RaceDZ? Reach out and we will get back to you as soon as possible.",
        emailLabel: "Email",
        email: "hello@racedz.dz",
        phoneLabel: "Phone",
        phone: "+213 555 123 456",
        hoursLabel: "Office hours",
        hours: "Saturday to Thursday, 9:00 AM to 5:00 PM Algeria time"
      },
      terms: {
        title: "Terms of use",
        intro: "By using RaceDZ, you agree to the following terms.",
        accountTitle: "Accounts",
        accountText:
          "You are responsible for keeping your account credentials secure. Provide accurate profile information, especially when registering for races that require identity verification.",
        registrationTitle: "Race registration",
        registrationText:
          "Registration does not guarantee entry until the organizer confirms your place and any required payment or documents are completed. Follow each organizer's rules and deadlines.",
        organizerTitle: "Organizer responsibilities",
        organizerText:
          "Organizers must provide accurate race details, communicate changes promptly, and handle participant data responsibly. RaceDZ provides tools; organizers are responsible for event execution.",
        contentTitle: "Content and conduct",
        contentText:
          "Do not post misleading, harmful, or illegal content. We may suspend accounts or remove content that violates these terms or harms the community."
      },
      privacy: {
        title: "Privacy policy",
        intro: "RaceDZ collects only the information needed to help you discover and register for races.",
        dataTitle: "What we collect",
        dataText:
          "We store account details, profile information, race registrations, and any documents required by organizers. Organizer accounts also store contact and organization details.",
        useTitle: "How we use your data",
        useText:
          "Your data is used to manage registrations, share race information, and provide organizer tools. We do not sell personal data to third parties.",
        securityTitle: "Security",
        securityText:
          "We use industry-standard practices to protect your account and data. Passwords are hashed and access to admin tools is restricted.",
        rightsTitle: "Your rights",
        rightsText:
          "You can update or delete your profile from your account settings. For other data questions, contact us at hello@racedz.dz."
      },
      footerTagline: "Find, register, and manage races across Algeria."
    },
    search: {
      keyword: "Race, city, organizer",
      keywordLabel: "Search",
      allWilayas: "All wilayas",
      wilayaLabel: "Wilaya",
      allTypes: "All race types",
      typeLabel: "Race type",
      anyDistance: "Any distance",
      distanceLabel: "Distance",
      anyStatus: "Any status",
      statusLabel: "Status",
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
      about: "A propos",
      contact: "Contact",
      terms: "Conditions",
      privacy: "Confidentialite",
      findRace: "Trouver une course",
      login: "Connexion",
      openMenu: "Ouvrir le menu",
      closeMenu: "Fermer le menu"
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
      resultCount: "{count} courses trouvees",
      clearFilters: "Reinitialiser",
      emptyTitle: "Aucune course trouvee",
      emptyText: "Essayez de changer la wilaya, la distance ou le type de course."
    },
    raceDetail: {
      registrationCloses: "Inscriptions closes le {date}",
      placesAvailable: "{available} sur {total} places disponibles",
      registerNow: "S inscrire",
      registrationClosed: "Les inscriptions sont {status}.",
      categoriesTitle: "Distances et categories",
      elevationGain: "{meters}m de denivele positif",
      cutoffTime: "{hours}h limite",
      rulesTitle: "Reglement",
      noRules: "Le reglement sera publie par l organisateur.",
      documentsTitle: "Documents requis",
      noDocuments: "Aucun document requis pour le moment.",
      contactTitle: "Contact",
      organizerLabel: "Organisateur"
    },
    pages: {
      about: {
        title: "A propos de RaceDZ",
        intro:
          "RaceDZ est le moyen le plus simple de decouvrir, publier et s inscrire aux courses a pied en Algerie. Nous connectons les coureurs avec les courses sur route, trails, marathons et evenements communautaires.",
        runnersTitle: "Pour les coureurs",
        runnersText:
          "Parcourez les evenements a venir, filtrez par wilaya, distance et type de course, et inscrivez-vous en quelques minutes. Suivez vos inscriptions depuis votre compte.",
        organizersTitle: "Pour les organisateurs",
        organizersText:
          "Demandez l acces organisateur, publiez votre course, gerez les categories et tarifs, invitez votre equipe et suivez les participants avec des listes exportables.",
        adminsTitle: "Pour les administrateurs",
        adminsText:
          "Les administrateurs examinent les organisations et courses, gerent les roles utilisateurs et securisent la plateforme grace a un journal d audit et des flux d approbation."
      },
      organizers: {
        eyebrow: "Pour les organisateurs",
        title: "Publiez vos courses et gerez les participants avec moins de travail manuel.",
        intro:
          "RaceDZ donne aux clubs, associations et equipes evenementielles un espace pour publier les details de course, gerer les categories, inviter l equipe et suivre les inscriptions.",
        primaryCta: "Demander l acces organisateur",
        secondaryCta: "Voir les courses",
        dashboardCta: "Ouvrir le tableau organisateur",
        reviewNote: "L acces organisateur est examine avant la publication publique des courses.",
        workflowTitle: "Ce que les organisateurs peuvent faire",
        publishTitle: "Creer des evenements",
        publishText: "Ajoutez dates, lieux, categories, distances, tarifs, capacite, reglement et images de course.",
        registrationsTitle: "Gerer les inscriptions",
        registrationsText: "Suivez les coureurs, paiements, statuts participants et exportez les listes pour l operation terrain.",
        teamTitle: "Inviter votre equipe",
        teamText: "Ajoutez des membres, assignez des roles, renvoyez les invitations et revoquez les acces en attente.",
        updatesTitle: "Communiquer les changements",
        updatesText: "Publiez des annonces et notifiez les coureurs inscrits lorsque des details importants changent."
      },
      contact: {
        title: "Contactez-nous",
        intro: "Vous avez une question sur RaceDZ ? Ecrivez-nous et nous vous repondrons des que possible.",
        emailLabel: "Email",
        email: "hello@racedz.dz",
        phoneLabel: "Telephone",
        phone: "+213 555 123 456",
        hoursLabel: "Heures de bureau",
        hours: "Samedi a jeudi, 9h00 a 17h00 heure de l Algerie"
      },
      terms: {
        title: "Conditions d utilisation",
        intro: "En utilisant RaceDZ, vous acceptez les conditions suivantes.",
        accountTitle: "Comptes",
        accountText:
          "Vous etes responsable de la securite de vos identifiants. Fournissez des informations de profil exactes, en particulier pour les courses necessitant une verification d identite.",
        registrationTitle: "Inscription aux courses",
        registrationText:
          "L inscription ne garantit pas la participation tant que l organisateur n a pas confirme votre place et que tout paiement ou document requis n est pas complete. Respectez les regles et delais de chaque organisateur.",
        organizerTitle: "Responsabilites des organisateurs",
        organizerText:
          "Les organisateurs doivent fournir des informations exactes, communiquer les changements rapidement et traiter les donnees des participants de maniere responsable. RaceDZ fournit les outils; les organisateurs sont responsables de l organisation.",
        contentTitle: "Contenu et conduite",
        contentText:
          "Ne publiez pas de contenu trompeur, nuisible ou illegal. Nous pouvons suspendre des comptes ou supprimer du contenu en violation de ces conditions."
      },
      privacy: {
        title: "Politique de confidentialite",
        intro: "RaceDZ collecte uniquement les informations necessaires pour vous aider a decouvrir et vous inscrire aux courses.",
        dataTitle: "Ce que nous collectons",
        dataText:
          "Nous stockons les details du compte, les informations de profil, les inscriptions aux courses et les documents requis par les organisateurs. Les comptes organisateurs stockent egalement les coordonnees et details de l organisation.",
        useTitle: "Comment nous utilisons vos donnees",
        useText:
          "Vos donnees sont utilisees pour gerer les inscriptions, partager les informations de course et fournir les outils organisateurs. Nous ne vendons pas de donnees personnelles a des tiers.",
        securityTitle: "Securite",
        securityText:
          "Nous utilisons des pratiques standard pour proteger votre compte et vos donnees. Les mots de passe sont hashes et l acces aux outils admin est restreint.",
        rightsTitle: "Vos droits",
        rightsText:
          "Vous pouvez mettre a jour ou supprimer votre profil depuis les parametres de votre compte. Pour d autres questions, contactez-nous a hello@racedz.dz."
      },
      footerTagline: "Trouvez, inscrivez-vous et gerez des courses en Algerie."
    },
    search: {
      keyword: "Course, ville, organisateur",
      keywordLabel: "Rechercher",
      allWilayas: "Toutes les wilayas",
      wilayaLabel: "Wilaya",
      allTypes: "Tous les types",
      typeLabel: "Type de course",
      anyDistance: "Toute distance",
      distanceLabel: "Distance",
      anyStatus: "Tout statut",
      statusLabel: "Statut",
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
      about: "من نحن",
      contact: "اتصل بنا",
      terms: "الشروط",
      privacy: "الخصوصية",
      findRace: "ابحث عن سباق",
      login: "تسجيل الدخول",
      openMenu: "فتح القائمة",
      closeMenu: "إغلاق القائمة"
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
      resultCount: "{count} سباقات",
      clearFilters: "مسح الفلاتر",
      emptyTitle: "لا توجد سباقات",
      emptyText: "جرّب تغيير الولاية أو المسافة أو نوع السباق."
    },
    raceDetail: {
      registrationCloses: "إغلاق التسجيلات {date}",
      placesAvailable: "{available} من أصل {total} مقاعد متاحة",
      registerNow: "سجّل الآن",
      registrationClosed: "التسجيلات {status}.",
      categoriesTitle: "المسافات والفئات",
      elevationGain: "{meters}م ارتفاع",
      cutoffTime: "{hours}س حد أقصى",
      rulesTitle: "قواعد السباق",
      noRules: "سينشر المنظم قواعد السباق لاحقًا.",
      documentsTitle: "المستندات المطلوبة",
      noDocuments: "لا توجد مستندات مطلوبة حاليًا.",
      contactTitle: "تواصل",
      organizerLabel: "المنظم"
    },
    pages: {
      about: {
        title: "عن RaceDZ",
        intro:
          "RaceDZ هو أبسط طريقة لاكتشاف ونشر والتسجيل في سباقات الجري عبر الجزائر. نربط العدائين بسباقات الطريق والترايل والماراثون والفعاليات المجتمعية في مكان واحد.",
        runnersTitle: "للعدائين",
        runnersText:
          "تصفح الأحداث القادمة، رشّح حسب الولاية والمسافة ونوع السباق، وسجّل في دقائق. تتبع تسجيلاتك من لوحة حسابك.",
        organizersTitle: "للمنظمين",
        organizersText:
          "اطلب صلاحيات المنظم، انشر سباقك، أدر الفئات والأسعار، ادعُ فريقك، وتتبع المشاركين بقوائم قابلة للتصدير.",
        adminsTitle: "للمدراء",
        adminsText:
          "يدير المشرفون والمدرون المنظمات والسباقات، ويتحكمون في أدوار المستخدمين، ويحافظون على أمان المنصة عبر سجل التدقيق ومسارات الموافقة."
      },
      organizers: {
        eyebrow: "للمنظمين",
        title: "انشر السباقات وأدر المشاركين بعمل يدوي أقل.",
        intro:
          "يوفر RaceDZ للأندية والجمعيات وفرق التنظيم مكانا واحدا لنشر تفاصيل السباق، إدارة الفئات، دعوة الفريق، وتتبع التسجيلات.",
        primaryCta: "اطلب صلاحية منظم",
        secondaryCta: "تصفح السباقات",
        dashboardCta: "افتح لوحة المنظم",
        reviewNote: "تتم مراجعة صلاحية المنظم قبل نشر السباقات للعموم.",
        workflowTitle: "ما الذي يمكن للمنظمين فعله",
        publishTitle: "إنشاء أحداث السباق",
        publishText: "أضف التواريخ، المواقع، الفئات، المسافات، الأسعار، السعة، القواعد وصور السباق.",
        registrationsTitle: "إدارة التسجيلات",
        registrationsText: "تابع العدائين، حالة الدفع، حالة المشاركة، وصدر قوائم التسجيل لتشغيل يوم السباق.",
        teamTitle: "دعوة الفريق",
        teamText: "أضف أعضاء للمنظمة، عيّن الأدوار، أعد إرسال الدعوات، وألغ الوصول المعلق عند الحاجة.",
        updatesTitle: "إبلاغ التغييرات",
        updatesText: "انشر الإعلانات وأخبر العدائين المسجلين عند تغيير تفاصيل مهمة في السباق."
      },
      contact: {
        title: "اتصل بنا",
        intro: "هل لديك سؤال حول RaceDZ؟ تواصل معنا وسنرد عليك في أقرب وقت ممكن.",
        emailLabel: "البريد الإلكتروني",
        email: "hello@racedz.dz",
        phoneLabel: "الهاتف",
        phone: "+213 555 123 456",
        hoursLabel: "ساعات العمل",
        hours: "من السبت إلى الخميس، من 9:00 صباحًا حتى 5:00 مساءً بتوقيت الجزائر"
      },
      terms: {
        title: "شروط الاستخدام",
        intro: "باستخدامك RaceDZ، فإنك توافق على الشروط التالية.",
        accountTitle: "الحسابات",
        accountText:
          "أنت مسؤول عن الحفاظ على أمان بيانات حسابك. قدّم معلومات ملف شخصي دقيقة، خاصةً للسباقات التي تتطلب التحقق من الهوية.",
        registrationTitle: "التسجيل في السباقات",
        registrationText:
          "التسجيل لا يضمن المشاركة حتى يؤكد المنظم مقعدك ويُكمل أي دفعة أو مستندات مطلوبة. اتبع قواعد ومواعيد كل منظم.",
        organizerTitle: "مسؤوليات المنظم",
        organizerText:
          "يجب على المنظمين تقديم تفاصيل دقيقة عن السباق، والتواصل بسرعة مع التغييرات، والتعامل مع بيانات المشاركين بمسؤولية. RaceDZ يوفر الأدوات؛ والمنظمون مسؤولون عن تنظيم الفعالية.",
        contentTitle: "المحتوى والسلوك",
        contentText:
          "لا تنشر محتوى مضلل أو ضار أو غير قانوني. قد نقوم بتعليق الحسابات أو إزالة المحتوى الذي ينتهك هذه الشروط أو يضر بالمجتمع."
      },
      privacy: {
        title: "سياسة الخصوصية",
        intro: "تجمع RaceDZ فقط المعلومات اللازمة لمساعدتك في اكتشاف السباقات والتسجيل فيها.",
        dataTitle: "ما نجمعه",
        dataText:
          "نخزن تفاصيل الحساب، ومعلومات الملف الشخصي، وتسجيلات السباقات، وأي مستندات يطلبها المنظمون. تخزن حسابات المنظمين أيضًا بيانات الاتصال وتفاصيل المنظمة.",
        useTitle: "كيف نستخدم بياناتك",
        useText:
          "تُستخدم بياناتك لإدارة التسجيلات، ومشاركة معلومات السباق، وتوفير أدوات المنظمين. لا نبيع البيانات الشخصية لأطراف ثالثة.",
        securityTitle: "الأمان",
        securityText:
          "نستخدم ممارسات قياسية لحماية حسابك وبياناتك. كلمات المرور مُعمّاة ويقتصر الوصول إلى أدوات الإدارة على المصرح لهم.",
        rightsTitle: "حقوقك",
        rightsText:
          "يمكنك تحديث أو حذف ملفك الشخصي من إعدادات حسابك. لأي استفسارات أخرى، تواصل معنا على hello@racedz.dz."
      },
      footerTagline: "اكتشف وسجّل و أدر سباقات في الجزائر."
    },
    search: {
      keyword: "سباق، مدينة، منظم",
      keywordLabel: "بحث",
      allWilayas: "كل الولايات",
      wilayaLabel: "الولاية",
      allTypes: "كل الأنواع",
      typeLabel: "نوع السباق",
      anyDistance: "أي مسافة",
      distanceLabel: "المسافة",
      anyStatus: "أي حالة",
      statusLabel: "الحالة",
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
