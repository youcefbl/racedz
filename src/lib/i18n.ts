export const LOCALES = ["en", "fr", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  ar: "AR"
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية"
};

export const dictionaries = {
  en: {
    nav: {
      races: "Races",
      blog: "Blog",
      organizers: "Organizers",
      forRunners: "For Runners",
      aiCoach: "AI Coach",
      pricing: "Pricing",
      home: "Home",
      runs: "Runs",
      coach: "Coach",
      account: "Account",
      rankings: "Rankings",
      admin: "Admin",
      about: "About",
      contact: "Contact",
      terms: "Terms",
      privacy: "Privacy",
      faq: "FAQ",
      findRace: "Find a Race",
      login: "Login",
      signUp: "Sign Up",
      openMenu: "Open menu",
      closeMenu: "Close menu"
    },
    home: {
      eyebrow: "ZidRun",
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
      organizerText: "Create your event and manage registrations online with ZidRun."
    },
    races: {
      eyebrow: "Race calendar",
      title: "Upcoming races in Algeria",
      resultCount: "{count} races found",
      clearFilters: "Clear filters",
      upcomingOnly: "Upcoming only",
      showPast: "Show past races",
      completed: "Completed",
      emptyTitle: "No races found",
      emptyText: "No published races yet. Check back soon.",
      emptyFilteredTitle: "No races match your filters",
      emptyFilteredText: "Try widening your search or clearing the filters.",
      sortLabel: "Sort",
      sortDate: "Soonest",
      sortDistance: "Distance",
      sortPrice: "Price",
      filters: "Filters",
      metaTitle: "Races",
      metaDescription: "Browse upcoming running races and trail events in Algeria."
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
      organizerLabel: "Organizer",
      eventElevationGain: "Elevation gain",
      conditionsTitle: "Race conditions",
      announcementsTitle: "Race announcements",
      notFound: "Race not found",
      raceImageAlt: "{title} race image",
      platformBadge: "ZidRun platform-created",
      yourRegistration: "Your registration",
      registeredOn: "Registered {date}",
      viewRegistration: "View registration details",
      registerAnother: "Register another distance"
    },
    registration: {
      metaTitle: "Register for race",
      eyebrow: "Registration",
      intro:
        "Confirm your race distance and emergency contact. Your account profile will be refreshed with the runner details you submit here.",
      closes: "Closes {date}",
      organizer: "Organizer",
      distances: "Distances",
      viewRaceDetails: "View race details",
      notOpen: "Registration is not open for this race.",
      allRegistered: "You are already registered for every available distance in this race.",
      runnerDetails: "Runner details",
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone",
      dateOfBirth: "Date of birth",
      gender: "Gender",
      genderMale: "Male",
      genderFemale: "Female",
      genderOther: "Other",
      wilaya: "Wilaya",
      city: "City",
      raceSelection: "Race selection",
      distance: "Distance",
      tshirtSize: "T-shirt size",
      noPreference: "No preference",
      emergencyName: "Emergency contact name",
      emergencyPhone: "Emergency contact phone",
      club: "Club or team",
      acceptRules: "I accept the race rules and confirm my participant information is accurate.",
      saving: "Saving registration...",
      complete: "Complete Registration"
    },
    pages: {
      blog: {
        metaTitle: "Running Blog — Gear, Training & Racing in Algeria",
        metaDescription:
          "Guides, gear reviews, and training tips for runners in Algeria — the best shoes, watches, and accessories you can actually buy locally.",
        eyebrow: "ZidRun Journal",
        title: "The running blog for Algeria",
        subtitle: "Gear guides, training advice, and race tips — written for runners on the ground in Algeria.",
        featured: "Featured",
        readMore: "Read article",
        backToBlog: "All articles",
        minRead: "{n} min read",
        publishedOn: "Published",
        updatedOn: "Updated",
        by: "By",
        relatedTitle: "Keep reading",
        allCategories: "All",
        empty: "No articles yet — check back soon.",
        categories: {
          gear: "Gear",
          training: "Training",
          racing: "Racing",
          nutrition: "Nutrition",
          beginner: "Beginner"
        }
      },
      about: {
        title: "About ZidRun",
        intro:
          "ZidRun is the simplest way to discover, publish, and register for running races across Algeria. We connect runners with road races, trail runs, marathons, and community events in one searchable place.",
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
      coachLanding: {
        eyebrow: "ZidRun Coach",
        title: "Your AI running coach, free for 7 days.",
        intro:
          "Set a goal, log your runs, and get a personalized weekly plan with feedback — built from your real training, not a generic template.",
        trialBadge: "Free for 7 days",
        primaryCta: "Start 7-day free trial",
        primaryCtaMember: "Open your coach",
        secondaryCta: "Browse races",
        trialNote: "No card required. Your first 7 days of coaching are on us.",
        featuresTitle: "Everything your training needs",
        planTitle: "Smart weekly plans",
        planText: "A conservative, personalized plan from your recent volume and availability — adjusted every week.",
        runsTitle: "Log every run",
        runsText: "Record distance, pace, fatigue, and notes, or track live with GPS and a route map.",
        reviewsTitle: "AI coach reviews",
        reviewsText: "Clear feedback after each run and a focused review before every new training week.",
        goalsTitle: "Goals that fit your life",
        goalsText: "Set your target race, weekly availability, and long-run day — the coach plans around you.",
        langNote: "Coaching in Arabic, French, or English — your choice.",
        howTitle: "How it works",
        step1Title: "Set your goal",
        step1Text: "Tell the coach your target race and how much you can train.",
        step2Title: "Log your runs",
        step2Text: "Add each run or track it live; the coach learns your real fitness.",
        step3Title: "Get your plan",
        step3Text: "Receive a weekly plan and a review tuned to your progress.",
        ctaTitle: "Ready to run smarter?",
        ctaText: "Try the AI coach free for 7 days and see your next workout today.",
        personalizeTitle: "A plan built around you, not a template",
        personalizeText: "The coach shapes every training week to who you are — your fitness, your body, your history, and your week — and keeps every session safe.",
        factorLevelTitle: "Your level",
        factorLevelText: "Whether you're building your first base or chasing a personal best, the plan meets you exactly where you are.",
        factorBodyTitle: "Your body",
        factorBodyText: "Weight, height, and resting heart rate tune your training load, easy pace, and recovery.",
        factorInjuryTitle: "Your history",
        factorInjuryText: "Past injuries, niggles, and health notes keep every session conservative and joint-friendly.",
        factorScheduleTitle: "Your week",
        factorScheduleText: "Tell it your available days and long-run day, and the plan fits around your real life.",
        guidanceNote: "The coach keeps adjusting week after week — and reviews every run — until you reach the goal you set on day one.",
        tipsTitle: "Daily tips that fit you",
        tipsText: "Short, practical coaching tips matched to your level and goal — a fresh one whenever you need a nudge, never a generic feed.",
        langTitle: "Coaching in your language",
        langText: "Every plan, review, and tip in Arabic, French, or English — switch anytime, right-to-left included."
      },
      organizers: {
        eyebrow: "For organizers",
        title: "Publish races and manage participants with less manual work.",
        intro:
          "ZidRun gives clubs, associations, and event teams one place to publish race details, manage categories, invite teammates, and track registrations.",
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
      runners: {
        eyebrow: "For runners",
        title: "Find your race, register in minutes, and train with an AI coach.",
        intro:
          "ZidRun brings every running event in Algeria into one place — discover races, register online, track your entries, and follow a personalized training plan.",
        primaryCta: "Find a race",
        secondaryCta: "Create your account",
        dashboardCta: "My registrations",
        workflowTitle: "Everything a runner needs",
        discoverTitle: "Discover races",
        discoverText: "Browse upcoming road, trail, and community races. Filter by wilaya, distance, date, and race type.",
        registerTitle: "Register & track",
        registerText: "Sign up online in minutes and keep all your registrations and their status in one dashboard.",
        coachTitle: "Train with the AI coach",
        coachText: "Set a goal, log your runs, and get a safe, personalized weekly plan and post-run feedback in your language.",
        remindersTitle: "Stay updated",
        remindersText: "Get race confirmations, schedule changes, and reminders by email and push notification.",
        appEyebrow: "ZidRun mobile",
        appTitle: "Take ZidRun with you on race day.",
        appText: "The mobile app adds runner-only features on top of everything on the website.",
        appFeature1: "Record runs with live GPS — distance, pace, elevation, and a route map.",
        appFeature2: "Your training plan and next workout, always in your pocket.",
        appFeature3: "Push reminders for registration deadlines and race starts.",
        appBadge: "Android now · iOS coming soon",
        trackTitle: "Record your runs",
        trackText: "Track live with GPS — distance, pace, per-km splits, elevation, and your route on a map.",
        rankTitle: "Climb the rankings",
        rankText: "Share your runs and see the fastest paces and longest distances across your wilaya.",
        appThemesNote: "Light, dark, or race mode — the app adapts to how you like it.",
        appShotAltLight: "ZidRun app home screen in light mode, showing race search and open registrations.",
        appShotAltDark: "ZidRun app home screen in dark mode, showing race search and open registrations."
      },
      rankings: {
        eyebrow: "Leaderboards",
        title: "Best runs across Algeria",
        intro: "See the fastest paces and longest runs shared by ZidRun runners in each wilaya.",
        allWilayas: "All wilayas",
        wilayaLabel: "Wilaya",
        filter: "Show",
        allTime: "All-time",
        thisMonth: "This month",
        bestPace: "Best pace",
        longestDistance: "Longest distance",
        empty: "No public runs yet. Share a run to appear here.",
        shareCta: "Record & share a run"
      },
      contact: {
        title: "Contact us",
        intro: "Have a question about ZidRun? Reach out and we will get back to you as soon as possible.",
        emailLabel: "Email",
        email: "contact@zidrun.com",
        phoneLabel: "Phone",
        phone: "0553 19 17 33",
        whatsappLabel: "WhatsApp",
        whatsapp: "0553 19 17 33",
        hoursLabel: "Office hours",
        hours: "Saturday to Thursday, 9:00 AM to 5:00 PM Algeria time",
        aboutTitle: "About us",
        aboutLead: "We believe health is the most valuable asset anyone can own — and running is one of the best ways to protect it.",
        aboutText:
          "That belief is why ZidRun exists. We care about our community, and we want to see people who are healthier, more energetic, and full of good energy to share with those around them. So we built a home for runners: a place to stay motivated, find guidance, and learn from one another, one kilometer at a time."
      },
      terms: {
        title: "Terms of Service",
        updated: "Last updated: 8 July 2026",
        intro:
          "These Terms of Service (“Terms”) govern your access to and use of ZidRun — our website, mobile app, and related services (together, the “Service”). ZidRun is a platform for discovering and registering for running races in Algeria and for training with an AI running coach. By creating an account or using the Service, you agree to these Terms. If you do not agree, please do not use the Service.",
        note:
          "We provide these Terms in English, French, and Arabic for your convenience. If there is any conflict between the versions, the English version prevails. This document is a general agreement and not a substitute for legal advice.",
        sections: [
          {
            id: "acceptance",
            title: "1. Who we are & acceptance",
            body:
              "ZidRun (“ZidRun”, “we”, “us”, “our”) operates the Service in Algeria. These Terms form a binding agreement between you and ZidRun.\nYou must be at least 16 years old to create an account. If you are under 18, you confirm that a parent or legal guardian has reviewed and accepts these Terms and supervises your use. If you use the Service on behalf of an organization, you confirm you are authorized to bind that organization to these Terms."
          },
          {
            id: "accounts",
            title: "2. Your account",
            body:
              "You are responsible for keeping your login credentials secure and for all activity under your account. Provide accurate, up-to-date information, especially where a race requires identity verification. Notify us promptly of any unauthorized use. We may suspend or restrict accounts that appear compromised or that breach these Terms."
          },
          {
            id: "platform-role",
            title: "3. ZidRun is a platform",
            body:
              "Races are created, managed, and run by independent organizers. ZidRun provides tools that connect runners and organizers; we are not the organizer and are not a party to your agreement with an organizer.\nWe do not control and are not responsible for a race taking place, its safety, timing, results, cancellation, or any refund of its fees. The AI coach provides automated, general guidance only. We may remove content, listings, or accounts that violate these Terms or the law."
          },
          {
            id: "race-registration",
            title: "4. Race registration",
            body:
              "Registering for a race expresses your intent to take part. A place is confirmed only when the organizer accepts your registration and any required fee or documents are completed. Organizers set their own eligibility, categories, prices, deadlines, and rules, and you agree to follow them. You must provide accurate identity information where required. Registrations may be cancelled under an organizer's rules or for non-payment."
          },
          {
            id: "payments",
            title: "5. Payments & pricing",
            body:
              "Prices are shown in Algerian dinar (DA). Payment is handled manually: you pay race fees and coach subscriptions by BaridiMob, CCP, CIB/Edahabia, or another method we indicate, and upload proof of payment. We do not process card payments through the Service and do not store card numbers.\nA coach subscription is activated after we review your proof of payment. Race fees are collected as directed by the organizer. Prices and plans may change; the price shown to you at the time of a purchase applies to that purchase."
          },
          {
            id: "coach-subscription",
            title: "6. AI coach subscription",
            body:
              "Every new account includes a free trial of the AI coach (currently 7 days). After the trial, continued access requires a paid subscription (monthly or yearly). A subscription is a personal, non-transferable, limited licence to use the coach for its term.\nSubscriptions do not renew automatically — you choose to re-subscribe to continue. Usage may be subject to fair-use limits, and we may change coach features or limits over time."
          },
          {
            id: "fulfillment",
            title: "7. Fulfillment (how the Service is delivered)",
            body:
              "The Service is delivered digitally.\n• AI coach: access is granted to your account once your subscription is activated after payment review, and you can use it immediately for the paid term.\n• Race registration: fulfillment happens when the organizer confirms your place. Anything on race day — bibs, timing, and the event itself — is provided and fulfilled by the organizer, not ZidRun.\nBecause digital access is provided immediately on activation, you agree that we may begin delivering it right away."
          },
          {
            id: "refunds",
            title: "8. Refund policy",
            body:
              "The free trial lets you evaluate the AI coach before paying. Once a coach subscription is activated, fees are non-refundable, except where a refund is required by applicable law or granted by ZidRun at its discretion — for example, a duplicate payment or a proven billing error on our side.\nRace registration fees are set and collected under each organizer's rules. Requests to cancel or refund a race entry are decided by the organizer, not by ZidRun. To raise a billing issue with us, contact contact@zidrun.com within 14 days of the charge and include your proof of payment."
          },
          {
            id: "ai-health",
            title: "9. AI coach & your health",
            body:
              "The AI coach provides general training guidance and information only. It is not medical, health, or professional advice, and it is not a substitute for a qualified professional. Consult a doctor before starting or changing any training programme, especially if you have a health condition, are injured, are pregnant, or are unsure whether exercise is safe for you.\nRunning and physical activity carry inherent risks. You take part voluntarily and at your own risk, and you are responsible for training within your limits and stopping if you feel unwell."
          },
          {
            id: "acceptable-use",
            title: "10. Acceptable use",
            body:
              "When using the Service, you agree not to:\n• break any applicable law or third-party rights;\n• post false, misleading, harmful, infringing, hateful, or offensive content;\n• impersonate others or misrepresent your identity or affiliation;\n• disrupt, overload, scrape, reverse-engineer, or attempt to gain unauthorized access to the Service;\n• misuse other users' personal data, or use the Service to send spam.\nProvide honest, accurate information to the coach (including health details). We may remove content and suspend accounts that break these rules."
          },
          {
            id: "your-content",
            title: "11. Your content & intellectual property",
            body:
              "You keep ownership of the content you submit (such as your profile, runs, messages, and race data). You grant ZidRun a non-exclusive, worldwide, royalty-free licence to host, store, display, and process that content solely to operate, secure, and improve the Service. You are responsible for what you submit and confirm you have the right to submit it.\nThe ZidRun name, logo, software, and design are owned by ZidRun and protected by law. We grant you a limited, revocable, non-transferable licence to use the Service for its intended purpose; no other rights are granted."
          },
          {
            id: "third-parties",
            title: "12. Third-party services, availability & changes",
            body:
              "The Service relies on third parties — for example hosting, email and push-notification delivery, and map and weather data — and may link to organizer or external resources. We are not responsible for third-party services or content, which may have their own terms.\nWe may add, change, suspend, or discontinue any part of the Service at any time, and it may be unavailable during maintenance or for reasons outside our control. Some features may be offered on a trial or beta basis."
          },
          {
            id: "warranty",
            title: "13. Disclaimer of warranties",
            body:
              "The Service is provided “as is” and “as available”, without warranties of any kind, whether express, implied, or statutory. To the maximum extent permitted by law, we disclaim all implied warranties, including merchantability, fitness for a particular purpose, non-infringement, accuracy, and uninterrupted or error-free operation.\nWe do not warrant that races, results, coaching guidance, weather, or other information on the Service are accurate, complete, current, or reliable, and any reliance on them is at your own risk. Some jurisdictions do not allow certain warranty exclusions, so some of the above may not apply to you."
          },
          {
            id: "liability",
            title: "14. Limitation of liability",
            body:
              "To the maximum extent permitted by law, ZidRun and its team, suppliers, and partners will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, goodwill, or for personal injury or losses arising from: your use of or inability to use the Service; races organized by third parties; your reliance on coaching guidance or other information; or any physical activity you undertake.\nTo the maximum extent permitted by law, ZidRun's total aggregate liability for all claims relating to the Service will not exceed the greater of the amount you paid ZidRun in the 3 months before the event giving rise to the claim, or 5,000 DA.\nYou agree to indemnify and hold ZidRun harmless from claims, losses, and reasonable expenses arising from your content, your use of the Service, or your breach of these Terms or the law. Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable Algerian law."
          },
          {
            id: "termination",
            title: "15. Suspension, termination & changes to these Terms",
            body:
              "We may suspend or terminate your access if you breach these Terms or the law, or where needed to protect the Service or other users. You may stop using the Service and close your account at any time. Provisions that by their nature should survive termination — including amounts owed, disclaimers, liability limits, and governing law — continue to apply.\nWe may update these Terms from time to time. We will update the “last updated” date and, for material changes, provide reasonable notice. Continuing to use the Service after changes take effect means you accept the updated Terms."
          },
          {
            id: "law",
            title: "16. Governing law & disputes",
            body:
              "These Terms are governed by the laws of the People's Democratic Republic of Algeria. We will first try to resolve any dispute amicably — please contact us so we can help. Disputes that cannot be resolved amicably fall under the exclusive jurisdiction of the competent courts of Algiers, without prejudice to any mandatory consumer-protection rights available to you under Algerian law."
          },
          {
            id: "contact",
            title: "17. Contact",
            body:
              "Questions about these Terms? Contact us at contact@zidrun.com, or from your account through Account → Chat with support."
          }
        ]
      },
      privacy: {
        title: "Privacy Policy",
        updated: "Last updated: 8 July 2026",
        intro:
          "This Privacy Policy explains what data ZidRun collects, how we use it, and the choices you have. It applies to our website, mobile app, and related services. ZidRun operates in Algeria and is committed to collecting only what we need to run the Service.",
        note:
          "We provide this policy in English, French, and Arabic. If there is any conflict between the versions, the English version prevails.",
        sections: [
          {
            id: "data",
            title: "1. Information we collect",
            body:
              "We collect:\n• Account & profile: name, email, phone, and optional details such as gender, date of birth, city/wilaya, national ID (when a race requires it), and avatar.\n• Race activity: your registrations and any documents an organizer requires.\n• AI coach data: the training and health details you choose to provide (goals, training history, injuries, ongoing health conditions, weight), and, if you record runs, your run metrics and GPS routes.\n• Messages: support chat messages you send us.\n• Organizer data: for organizer accounts, contact and organization details.\n• Payment proof: the screenshot you upload to confirm a manual payment. We do not collect or store card numbers.\n• Device & usage: basic technical data (such as approximate pages viewed and app/version) collected through our own first-party analytics."
          },
          {
            id: "use",
            title: "2. How we use your data",
            body:
              "We use your data to: create and secure your account; manage race registrations and share the information organizers need to confirm your place; provide and personalize your AI coach; deliver notifications you have not turned off; review manual payments; measure and improve the Service; and keep it safe and comply with law.\nThe AI coach offers training guidance only and is not medical advice. Runs are private by default and appear on public leaderboards only if you explicitly choose to share them. We do not sell your personal data."
          },
          {
            id: "sharing",
            title: "3. When we share data",
            body:
              "We share data only as needed to run the Service:\n• Organizers receive the registration details necessary to confirm and manage your entry in races you sign up for.\n• Service providers process data on our behalf — for example hosting, email delivery, and push notifications — under agreements that limit their use of it.\n• Legal & safety: we may disclose data where required by law or to protect the rights, safety, and security of ZidRun, our users, or the public.\nWe do not sell personal data or share it for third-party advertising."
          },
          {
            id: "cookies",
            title: "4. Cookies & similar technologies",
            body:
              "We use a small number of cookies and similar technologies. You can review and accept or reject non-essential cookies through the banner shown on your first visit, and you can change or delete cookies at any time in your browser settings.\n• Essential (sign-in): a secure session cookie set by our authentication system keeps you signed in. The Service cannot function without it, so it cannot be switched off.\n• Preferences: “racedz-locale” stores your chosen language and “racedz-theme” stores your appearance (light/dark/race). Each lasts about one year.\n• Analytics (first-party): “zr_vid” (about one year) and “zr_sid” (about 30 minutes) are random identifiers we use to measure aggregate usage, such as how many people visit and which pages are popular. These are our own cookies — we do not use third-party advertising or tracking cookies.\n• Consent: “zr_consent” remembers your cookie choice so we do not ask again.\nWe also store your theme preference and a one-time sync flag in your browser's local storage. If you reject non-essential cookies, we do not use analytics cookies. Turning off preference cookies simply resets your saved language and theme."
          },
          {
            id: "retention",
            title: "5. How long we keep data",
            body:
              "We keep your account and its data for as long as your account is active, and as needed to provide the Service, meet legal obligations, resolve disputes, and enforce our agreements. Analytics records are kept in aggregate and older raw records are periodically pruned. When you delete your account, we delete or anonymize your personal data, except where we must retain some of it by law."
          },
          {
            id: "security",
            title: "6. Security",
            body:
              "We use industry-standard practices to protect your account and data: passwords are hashed, access to admin tools is restricted, and connections are encrypted in transit. No online service can be completely secure, so please use a strong, unique password and keep your credentials safe."
          },
          {
            id: "rights",
            title: "7. Your rights & choices",
            body:
              "You can view and update most of your information, and turn run sharing on or off, from your account. You can manage notification channels in your notification settings, and manage cookies via the banner and your browser.\nYou may request access to, correction of, or deletion of your personal data, and you may withdraw consent for optional processing. To request deletion of your coaching and run data or exercise any right, contact us at hello@zidrun.com. We may need to verify your identity before acting on a request."
          },
          {
            id: "children",
            title: "8. Children",
            body:
              "The Service is not intended for children under 16. If you are under 18, you should use the Service only with the involvement of a parent or legal guardian. If you believe a child has provided us personal data without appropriate consent, contact us and we will take reasonable steps to remove it."
          },
          {
            id: "changes",
            title: "9. Changes & contact",
            body:
              "We may update this policy from time to time and will change the “last updated” date above; for material changes we will provide reasonable notice. For any privacy question or request, contact us at hello@zidrun.com."
          }
        ]
      },
      faq: {
        title: "Frequently asked questions",
        intro: "Quick answers about races, accounts, payments, and the AI coach. Still stuck? Chat with our team from your account.",
        items: [
          {
            q: "What is ZidRun?",
            a: "ZidRun helps you discover running races across Algeria, register for them, track your runs, and train with a personal AI coach — all in one place."
          },
          {
            q: "How do I register for a race?",
            a: "Open a race from the Races page, pick your category, and follow the steps. You'll need an account, and some races require a payment or documents that the organizer confirms."
          },
          {
            q: "Is ZidRun free?",
            a: "Browsing races, creating an account, and registering are free. Race entry fees are set by each organizer. The AI coach is free for your first week, then needs a subscription."
          },
          {
            q: "How does the AI coach free week work?",
            a: "Every new account gets a free trial of the AI coach. When it ends, subscribe monthly or yearly to keep your personalized plans, run analysis, and coaching chat."
          },
          {
            q: "How do I subscribe to the coach and pay?",
            a: "Go to Account → Coach subscription, choose a plan, pay by BaridiMob or CCP, and upload a screenshot of your transfer. Our team reviews it and activates your subscription shortly."
          },
          {
            q: "How do I change the language or theme?",
            a: "Open your Account screen and use the Language and Appearance sections. Your choice is saved to your account and follows you when you sign in on another device."
          },
          {
            q: "How do I contact support?",
            a: "Go to Account → Chat with support to message our team directly. We'll reply in the same chat and notify you when we do."
          },
          {
            q: "How do I become a race organizer?",
            a: "From your account, choose “Request organizer access.” Once approved, you can publish races and manage participants from the organizer dashboard."
          }
        ]
      },
      cookieBanner: {
        message:
          "We use essential cookies to run ZidRun, plus optional cookies to remember your preferences and measure usage. You can accept or reject the optional ones.",
        accept: "Accept",
        reject: "Reject non-essential",
        learnMore: "Cookie details"
      },
      blocked: {
        title: "Your account is blocked",
        message:
          "Your access to ZidRun has been suspended. If you think this is a mistake, please contact support and we'll take a look.",
        contactCta: "Contact support",
        backHome: "Back to home"
      },
      footerTagline: "Discover races, register, and train with an AI coach across Algeria.",
      footerRights: "All rights reserved.",
      footerDevelopedBy: "Developed by"
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
    account: {
      account: "Account",
      workspace: "Workspace",
      myRegistrations: "My registrations",
      profileSettings: "Profile settings",
      notifications: "Notifications",
      notificationSettings: "Notification settings",
      requestOrganizer: "Request organizer access",
      organizerDashboard: "Organizer dashboard",
      adminDashboard: "Admin dashboard",
      signedOut: "You're signed out",
      signedOutText: "Sign in to register for races and use your AI coach.",
      signIn: "Sign in",
      signUp: "Sign up",
      appearance: "Appearance",
      language: "Language",
      signOut: "Sign out",
      signingOut: "Signing out…",
      themeLight: "Light",
      themeDark: "Dark",
      themeRace: "Race",
      back: "Back",
      profile: "Profile",
      settings: "Settings",
      menuLabel: "Account menu",
      accountOverview: "Account overview",
      coach: "AI running coach",
      coachSubscription: "Coach subscription",
      support: "Chat with support",
      supportIntro: "Questions about races, your account, or the coach? Message the ZidRun team and we'll reply here.",
      supportPlaceholder: "Type your message…",
      supportSend: "Send",
      supportSending: "Sending…",
      supportEmpty: "No messages yet. Send us a message and we'll get back to you.",
      supportYou: "You",
      supportTeam: "ZidRun team",
      supportLoadError: "Couldn't load your messages. Please try again.",
      supportSendError: "Couldn't send your message. Please try again.",
      supportClosedNote: "This conversation was marked resolved. Send a message to reopen it.",
      welcomeTitle: "Welcome to ZidRun!",
      welcomeIntro: "Let's get you set up — two quick steps and you're ready to run.",
      welcomeProfileTitle: "Complete your profile",
      welcomeProfileText: "Add your phone, city, and a few details so organizers can confirm your race entries.",
      welcomeProfileCta: "Fill my info",
      welcomeCoachTitle: "Set up your AI coach",
      welcomeCoachText: "Answer a few questions for a personalized training plan. Free for your first week.",
      welcomeCoachCta: "Start the coach",
      welcomeSkip: "Skip for now",
      confirmSignOut: "Confirm sign out?",
      signOutError: "Couldn't sign you out. Please try again."
    },
    profile: {
      eyebrow: "Account",
      title: "Profile settings",
      intro: "Keep your runner identity and location ready so race registration stays fast and accurate.",
      identity: "Identity",
      firstName: "First name",
      lastName: "Last name",
      arabicName: "Arabic full name",
      phone: "Phone",
      dateOfBirth: "Date of birth",
      idNumber: "ID number",
      gender: "Gender",
      genderUnspecified: "Not specified",
      genderMale: "Male",
      genderFemale: "Female",
      genderOther: "Other",
      accountEmail: "Account email",
      location: "Location",
      wilaya: "Wilaya",
      city: "City",
      commune: "Commune",
      avatar: "Avatar",
      avatarImage: "Avatar image",
      saving: "Saving profile...",
      save: "Save profile settings",
      saveSuccess: "Profile settings saved.",
      validationError: "Check the required profile fields and try again.",
      idTaken: "This ID number is already used by another account."
    },
    notifications: {
      eyebrow: "Account",
      title: "Notifications",
      pageIntro: "Race approvals, registration updates, organizer messages, and account alerts appear here.",
      emptyTitle: "No notifications yet",
      emptyText: "New ZidRun updates will appear here when there is something you need to review.",
      markAllRead: "Mark all as read ({count})",
      unread: "Unread",
      open: "Open",
      markRead: "Mark read",
      panelTitle: "Notifications",
      panelSubtitle: "Latest ZidRun updates",
      panelEmpty: "No updates yet",
      panelCaughtUp: "You are all caught up.",
      unreadCount: "{count} unread notifications",
      markReadError: "Couldn't update notifications. Please try again."
    },
    notificationSettings: {
      eyebrow: "Account",
      title: "Notification settings",
      intro:
        "Choose which ZidRun updates can reach you by email or push. In-app notifications stay enabled for important account history.",
      columnNotification: "Notification",
      columnEmail: "Email",
      columnPush: "Push",
      emailFor: "Email for {name}",
      pushFor: "Push for {name}",
      save: "Save settings",
      saved: "Preferences saved."
    },
    registrations: {
      eyebrow: "Account",
      title: "My registrations",
      intro: "Track your race entries, payment state, and event details from one place.",
      findAnother: "Find another race",
      savedBanner: "Registration saved. The organizer can now review and confirm your entry.",
      emptyTitle: "No registrations yet",
      emptyText: "Browse open races and register for the distance that fits your training.",
      browse: "Browse races",
      raceDetails: "Race details",
      addDistance: "Add distance"
    },
    pay: {
      title: "Payment required",
      amount: "Amount",
      payVia: "Pay to",
      baridiMob: "BaridiMob",
      ccp: "CCP",
      ccpKey: "key",
      note: "Note",
      noDetails: "The organizer hasn't added payment details yet. Contact them to arrange payment.",
      methodLabel: "How did you pay?",
      methodBaridiMob: "BaridiMob",
      methodCcp: "CCP / Algérie Poste",
      proofLabel: "Payment screenshot",
      proofHelp: "Upload a clear screenshot of your transfer so the organizer can confirm it.",
      submit: "Submit payment proof",
      submitting: "Submitting…",
      underReview: "Proof submitted — waiting for the organizer to confirm your payment.",
      resubmit: "Re-upload proof"
    },
    status: {
      PENDING: "Pending",
      CONFIRMED: "Confirmed",
      CANCELLED: "Cancelled",
      REJECTED: "Rejected",
      WAITING_LIST: "Waiting list",
      NOT_REQUIRED: "Not required",
      PAID: "Paid",
      FAILED: "Failed",
      REFUNDED: "Refunded",
      MANUAL_REVIEW: "Manual review"
    },
    auth: {
      loginEyebrow: "ZidRun account",
      loginHeadline: "Login once. Run your races or organize your events.",
      loginSub: "One secure email/password login for runners and race organizations.",
      featRunnersTitle: "Runners",
      featRunnersText: "Register and track entries.",
      featOrganizersTitle: "Organizers",
      featOrganizersText: "Manage events and lists.",
      featRaceDaysTitle: "Race days",
      featRaceDaysText: "Keep entries ready.",
      welcomeBack: "Welcome back",
      signIn: "Sign in",
      loginCardSub: "Use a demo account or your own ZidRun credentials.",
      or: "or",
      newRunner: "New runner?",
      createAccount: "Create account",
      emailLabel: "Email",
      emailPlaceholder: "runner@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "racedz-demo-password",
      signingIn: "Signing in...",
      login: "Login",
      demoAccounts: "Demo accounts",
      roleRunner: "Runner",
      roleOrganizer: "Organizer",
      copied: "Copied",
      copyValue: "Copy {value}",
      activatedNoEmail:
        "Account created, but the activation email could not be delivered. Contact support to activate or resend verification.",
      activatedCheckEmail: "Account created. Check your email and activate your account before logging in.",
      resendPrompt: "Didn't get the email?",
      resend: "Resend verification email",
      resendSending: "Sending…",
      resendSent: "Sent!",
      resendRetryIn: "Resend available in {s}s",
      forgotLink: "Forgot password?",
      forgotTitle: "Reset your password",
      forgotSubtitle: "Enter your email and we'll send you a link to set a new password.",
      forgotSubmit: "Send reset link",
      forgotSending: "Sending…",
      forgotSentTitle: "Check your email",
      forgotSentText: "If an account exists for that email, a password reset link is on its way. It expires in 1 hour.",
      backToLogin: "Back to sign in",
      resetTitle: "Choose a new password",
      resetSubtitle: "Enter a new password for your account.",
      resetNewPassword: "New password",
      resetConfirm: "Confirm new password",
      resetSubmit: "Update password",
      resetInvalid: "This reset link is invalid or has expired. Request a new one.",
      resetInvalidTitle: "Link expired",
      resetInvalidText: "This password reset link is invalid or has expired. Request a new one to continue.",
      resetSuccess: "Password updated. You can now sign in with your new password.",
      errInvalidInput: "Enter a valid email and password.",
      errNotActivated: "Check your email and activate your account before logging in.",
      googleSignInError: "Google sign-in couldn't be completed. Please try again.",
      errInvalidCredentials: "Invalid email or password.",
      registerEyebrow: "Runner account",
      registerHeadline: "Create your ZidRun profile once, then register faster.",
      registerSub:
        "Your profile pre-fills race forms, keeps registration history in one place, and helps organizers verify participant details.",
      registerFeat1Title: "Fast signup",
      registerFeat1Text: "Just your name and email to start — add race details later.",
      registerFeat2Title: "Race-ready when you are",
      registerFeat2Text: "Your details prefill race forms when you register.",
      registerFeat3Title: "Registration updates",
      registerFeat3Text: "Receive race confirmations and changes.",
      signUpWithGoogle: "Sign up with Google",
      continueWithGoogle: "Continue with Google",
      openingGoogle: "Opening Google...",
      coachPromoTitle: "Meet your AI running coach",
      coachPromoText: "Personalized weekly plans, run tracking, and coach feedback.",
      coachPromoCta: "Discover the AI Coach",
      orUseEmail: "or use email",
      yourName: "Your name",
      yourNameSub: "Just the basics to get started — you can add the rest later.",
      firstName: "First name",
      lastName: "Last name",
      loginSecurity: "Login security",
      loginSecuritySub: "You will need to verify your email before logging in.",
      passwordHint: "Use at least 8 characters.",
      hidePassword: "Hide password",
      showPassword: "Show password",
      confirmPassword: "Confirm password",
      passwordMismatch: "Passwords do not match.",
      hideConfirmPassword: "Hide confirmation password",
      showConfirmPassword: "Show confirmation password",
      registerFootnote:
        "After signup, verify your email. You'll add race details (phone, wilaya, ID) when you register for your first race.",
      creatingAccount: "Creating account...",
      errTooManySignups: "Too many signups from this network. Please try again later.",
      errCheckFields: "Check the highlighted fields and try again.",
      errEmailExists: "An account with this email already exists.",
      errUseDifferentEmail: "Use a different email or sign in.",
      verifiedTitle: "Account activated",
      verifiedText: "Your email is verified. You can now log in and register for races on ZidRun.",
      goToLogin: "Go to login",
      verifyExpiredTitle: "Verification link expired",
      verifyExpiredText:
        "This activation link is invalid, expired, or already used. Create a new account or ask support for a new verification email."
    },
    invite: {
      joinTitle: "Join {organization}",
      invitedBy:
        "{name} invited you to help manage race operations on ZidRun. Accepting adds your account to the organization with {role} access.",
      invitedEmail: "Invited email",
      role: "Role",
      organization: "Organization",
      invited: "Invited",
      acceptTitle: "Accept access",
      acceptText: "Sign in with {email}. Invitations cannot be accepted from a different email account.",
      signInToAccept: "Sign in to accept",
      createAccount: "Create account",
      cannotAccept: "This invitation cannot be accepted in its current status.",
      accepting: "Accepting...",
      acceptInvitation: "Accept invitation"
    },
    ui: {
      page: "Page",
      pageOf: "of",
      previous: "Previous",
      next: "Next",
      firstPage: "First page",
      previousPage: "Previous page",
      nextPage: "Next page",
      lastPage: "Last page",
      raceImageAlt: "{title} race image",
      from: "From {price}",
      placesAvailable: "{count} places available",
      optional: "optional"
    },
    common: {
      view: "View"
    }
  },
  fr: {
    nav: {
      races: "Courses",
      blog: "Blog",
      organizers: "Organisateurs",
      forRunners: "Pour les coureurs",
      aiCoach: "Coach IA",
      pricing: "Tarifs",
      home: "Accueil",
      runs: "Sorties",
      coach: "Coach",
      account: "Compte",
      rankings: "Classements",
      admin: "Admin",
      about: "À propos",
      contact: "Contact",
      terms: "Conditions",
      privacy: "Confidentialité",
      faq: "FAQ",
      findRace: "Trouver une course",
      login: "Connexion",
      signUp: "S'inscrire",
      openMenu: "Ouvrir le menu",
      closeMenu: "Fermer le menu"
    },
    home: {
      eyebrow: "ZidRun",
      title: "Trouvez votre prochaine course en Algérie.",
      subtitle: "Marathons, 10K, trails et événements communautaires au même endroit.",
      findRace: "Trouver une course",
      createEvent: "Créer un événement",
      heroNote: "Prochains événements ouverts en Algérie",
      upcomingEyebrow: "Courses à venir",
      upcomingTitle: "Inscriptions ouvertes",
      browseAll: "Tout parcourir",
      raceTypesEyebrow: "Types de courses",
      raceTypesTitle: "Pour tous les coureurs",
      roadRaces: "Courses sur route",
      trailRaces: "Trails",
      marathons: "Marathons",
      kidsRaces: "Courses enfants",
      organizerTitle: "Vous organisez une course ?",
      organizerText: "Créez votre événement et gérez les inscriptions en ligne avec ZidRun."
    },
    races: {
      eyebrow: "Calendrier des courses",
      title: "Courses à venir en Algérie",
      resultCount: "{count} courses trouvées",
      clearFilters: "Réinitialiser",
      upcomingOnly: "À venir uniquement",
      showPast: "Afficher les courses passées",
      completed: "Terminée",
      emptyTitle: "Aucune course trouvée",
      emptyText: "Aucune course publiée pour l'instant. Revenez bientôt.",
      emptyFilteredTitle: "Aucune course ne correspond à vos filtres",
      emptyFilteredText: "Élargissez votre recherche ou réinitialisez les filtres.",
      sortLabel: "Trier",
      sortDate: "Plus proche",
      sortDistance: "Distance",
      sortPrice: "Prix",
      filters: "Filtres",
      metaTitle: "Courses",
      metaDescription: "Parcourez les courses à pied et les trails à venir en Algérie."
    },
    raceDetail: {
      registrationCloses: "Clôture des inscriptions le {date}",
      placesAvailable: "{available} sur {total} places disponibles",
      registerNow: "S'inscrire",
      registrationClosed: "Les inscriptions sont {status}.",
      categoriesTitle: "Distances et catégories",
      elevationGain: "{meters} m de dénivelé positif",
      cutoffTime: "{hours}h de temps limite",
      rulesTitle: "Règlement",
      noRules: "Le règlement sera publié par l'organisateur.",
      documentsTitle: "Documents requis",
      noDocuments: "Aucun document requis pour le moment.",
      contactTitle: "Contact",
      organizerLabel: "Organisateur",
      eventElevationGain: "Dénivelé positif",
      conditionsTitle: "Conditions de course",
      announcementsTitle: "Annonces de la course",
      notFound: "Course introuvable",
      raceImageAlt: "Image de la course {title}",
      platformBadge: "Créée par ZidRun",
      yourRegistration: "Votre inscription",
      registeredOn: "Inscrit le {date}",
      viewRegistration: "Voir les détails de l'inscription",
      registerAnother: "Inscrire une autre distance"
    },
    registration: {
      metaTitle: "Inscription à la course",
      eyebrow: "Inscription",
      intro:
        "Confirmez votre distance et votre contact d'urgence. Votre profil sera mis à jour avec les informations de coureur que vous saisissez ici.",
      closes: "Clôture le {date}",
      organizer: "Organisateur",
      distances: "Distances",
      viewRaceDetails: "Voir les détails de la course",
      notOpen: "Les inscriptions ne sont pas ouvertes pour cette course.",
      allRegistered: "Vous êtes déjà inscrit à toutes les distances disponibles de cette course.",
      runnerDetails: "Informations du coureur",
      firstName: "Prénom",
      lastName: "Nom",
      email: "E-mail",
      phone: "Téléphone",
      dateOfBirth: "Date de naissance",
      gender: "Sexe",
      genderMale: "Homme",
      genderFemale: "Femme",
      genderOther: "Autre",
      wilaya: "Wilaya",
      city: "Ville",
      raceSelection: "Choix de la course",
      distance: "Distance",
      tshirtSize: "Taille de t-shirt",
      noPreference: "Sans préférence",
      emergencyName: "Nom du contact d'urgence",
      emergencyPhone: "Téléphone du contact d'urgence",
      club: "Club ou équipe",
      acceptRules: "J'accepte le règlement de la course et je confirme l'exactitude de mes informations de participant.",
      saving: "Enregistrement de l'inscription...",
      complete: "Finaliser l'inscription"
    },
    pages: {
      blog: {
        metaTitle: "Blog running — Équipement, entraînement & courses en Algérie",
        metaDescription:
          "Guides, tests d'équipement et conseils d'entraînement pour les coureurs en Algérie — les meilleures chaussures, montres et accessoires disponibles localement.",
        eyebrow: "Journal ZidRun",
        title: "Le blog running pour l'Algérie",
        subtitle: "Guides d'équipement, conseils d'entraînement et astuces course — écrits pour les coureurs en Algérie.",
        featured: "À la une",
        readMore: "Lire l'article",
        backToBlog: "Tous les articles",
        minRead: "{n} min de lecture",
        publishedOn: "Publié le",
        updatedOn: "Mis à jour le",
        by: "Par",
        relatedTitle: "À lire aussi",
        allCategories: "Tout",
        empty: "Aucun article pour l'instant — revenez bientôt.",
        categories: {
          gear: "Équipement",
          training: "Entraînement",
          racing: "Courses",
          nutrition: "Nutrition",
          beginner: "Débutant"
        }
      },
      about: {
        title: "À propos de ZidRun",
        intro:
          "ZidRun est le moyen le plus simple de découvrir, publier et s'inscrire aux courses à pied en Algérie. Nous connectons les coureurs avec les courses sur route, les trails, les marathons et les événements communautaires en un seul endroit.",
        runnersTitle: "Pour les coureurs",
        runnersText:
          "Parcourez les événements à venir, filtrez par wilaya, distance et type de course, et inscrivez-vous en quelques minutes. Suivez vos inscriptions depuis votre compte.",
        organizersTitle: "Pour les organisateurs",
        organizersText:
          "Demandez l'accès organisateur, publiez votre course, gérez les catégories et les tarifs, invitez votre équipe et suivez les participants avec des listes exportables.",
        adminsTitle: "Pour les administrateurs",
        adminsText:
          "Les administrateurs examinent les organisations et les courses, gèrent les rôles des utilisateurs et sécurisent la plateforme grâce à un journal d'audit et des flux d'approbation."
      },
      coachLanding: {
        eyebrow: "Coach ZidRun",
        title: "Votre coach de course IA, gratuit pendant 7 jours.",
        intro:
          "Fixez un objectif, enregistrez vos sorties et recevez un plan hebdomadaire personnalisé avec des retours — basé sur votre entraînement réel, pas un modèle générique.",
        trialBadge: "Gratuit pendant 7 jours",
        primaryCta: "Commencer l'essai gratuit de 7 jours",
        primaryCtaMember: "Ouvrir mon coach",
        secondaryCta: "Voir les courses",
        trialNote: "Sans carte bancaire. Vos 7 premiers jours de coaching sont offerts.",
        featuresTitle: "Tout ce dont votre entraînement a besoin",
        planTitle: "Plans hebdomadaires intelligents",
        planText: "Un plan personnalisé et prudent, basé sur votre volume récent et vos disponibilités — ajusté chaque semaine.",
        runsTitle: "Enregistrez chaque sortie",
        runsText: "Distance, allure, fatigue et notes, ou suivi en direct avec GPS et tracé du parcours.",
        reviewsTitle: "Analyses du coach IA",
        reviewsText: "Des retours clairs après chaque sortie et une analyse ciblée avant chaque nouvelle semaine.",
        goalsTitle: "Des objectifs adaptés à votre vie",
        goalsText: "Définissez votre course cible, vos disponibilités et votre jour de sortie longue — le coach s'adapte à vous.",
        langNote: "Coaching en arabe, français ou anglais — à votre choix.",
        howTitle: "Comment ça marche",
        step1Title: "Fixez votre objectif",
        step1Text: "Indiquez au coach votre course cible et votre disponibilité.",
        step2Title: "Enregistrez vos sorties",
        step2Text: "Ajoutez chaque sortie ou suivez-la en direct ; le coach apprend votre forme réelle.",
        step3Title: "Recevez votre plan",
        step3Text: "Obtenez un plan hebdomadaire et une analyse adaptés à votre progression.",
        ctaTitle: "Prêt à courir plus intelligemment ?",
        ctaText: "Essayez le coach IA gratuitement pendant 7 jours et découvrez votre prochaine séance dès aujourd'hui.",
        personalizeTitle: "Un plan conçu pour vous, pas un modèle",
        personalizeText: "Le coach adapte chaque semaine d'entraînement à qui vous êtes — votre forme, votre corps, votre passé et votre emploi du temps — en gardant chaque séance sûre.",
        factorLevelTitle: "Votre niveau",
        factorLevelText: "Que vous construisiez votre première base ou visiez un record, le plan vous rejoint là où vous êtes.",
        factorBodyTitle: "Votre corps",
        factorBodyText: "Poids, taille et fréquence cardiaque au repos ajustent la charge, l'allure facile et la récupération.",
        factorInjuryTitle: "Votre historique",
        factorInjuryText: "Blessures passées, gênes et notes de santé gardent chaque séance prudente et respectueuse des articulations.",
        factorScheduleTitle: "Votre semaine",
        factorScheduleText: "Indiquez vos jours disponibles et votre jour de sortie longue : le plan s'adapte à votre vie.",
        guidanceNote: "Le coach ajuste votre plan semaine après semaine — et analyse chaque sortie — jusqu'à ce que vous atteigniez l'objectif fixé au départ.",
        tipsTitle: "Des conseils quotidiens faits pour vous",
        tipsText: "Des conseils courts et pratiques adaptés à votre niveau et à votre objectif — un nouveau dès que vous en avez besoin.",
        langTitle: "Un coaching dans votre langue",
        langText: "Chaque plan, analyse et conseil en arabe, français ou anglais — changez quand vous voulez, de droite à gauche inclus."
      },
      organizers: {
        eyebrow: "Pour les organisateurs",
        title: "Publiez vos courses et gérez les participants avec moins de travail manuel.",
        intro:
          "ZidRun offre aux clubs, associations et équipes événementielles un espace unique pour publier les détails de la course, gérer les catégories, inviter l'équipe et suivre les inscriptions.",
        primaryCta: "Demander l'accès organisateur",
        secondaryCta: "Voir les courses",
        dashboardCta: "Ouvrir le tableau de bord organisateur",
        reviewNote: "L'accès organisateur est examiné avant la publication publique des courses.",
        workflowTitle: "Ce que les organisateurs peuvent faire",
        publishTitle: "Créer des événements",
        publishText: "Ajoutez les dates, lieux, catégories, distances, tarifs, capacité, règlement et images de course.",
        registrationsTitle: "Gérer les inscriptions",
        registrationsText:
          "Suivez les coureurs, les paiements, les statuts des participants et exportez les listes pour le jour de la course.",
        teamTitle: "Inviter votre équipe",
        teamText: "Ajoutez des membres, attribuez des rôles, renvoyez les invitations et révoquez les accès en attente.",
        updatesTitle: "Communiquer les changements",
        updatesText: "Publiez des annonces et notifiez les coureurs inscrits lorsque des détails importants changent."
      },
      runners: {
        eyebrow: "Pour les coureurs",
        title: "Trouvez votre course, inscrivez-vous en minutes et entraînez-vous avec un coach IA.",
        intro:
          "ZidRun rassemble tous les événements de course en Algérie au même endroit — découvrez des courses, inscrivez-vous en ligne, suivez vos inscriptions et un plan d'entraînement personnalisé.",
        primaryCta: "Trouver une course",
        secondaryCta: "Créer votre compte",
        dashboardCta: "Mes inscriptions",
        workflowTitle: "Tout ce qu'il faut au coureur",
        discoverTitle: "Découvrir les courses",
        discoverText: "Parcourez les courses sur route, trail et communautaires. Filtrez par wilaya, distance, date et type.",
        registerTitle: "S'inscrire et suivre",
        registerText: "Inscrivez-vous en ligne en quelques minutes et gardez toutes vos inscriptions et leur statut au même endroit.",
        coachTitle: "S'entraîner avec le coach IA",
        coachText: "Définissez un objectif, enregistrez vos sorties et recevez un plan hebdomadaire personnalisé et des retours, dans votre langue.",
        remindersTitle: "Rester informé",
        remindersText: "Recevez confirmations, changements d'horaire et rappels par e-mail et notification push.",
        appEyebrow: "ZidRun mobile",
        appTitle: "Emportez ZidRun le jour de la course.",
        appText: "L'application mobile ajoute des fonctionnalités réservées aux coureurs en plus du site.",
        appFeature1: "Enregistrez vos sorties en GPS — distance, allure, dénivelé et carte du parcours.",
        appFeature2: "Votre plan d'entraînement et la prochaine séance, toujours dans la poche.",
        appFeature3: "Rappels push pour les dates limites d'inscription et les départs.",
        appBadge: "Android maintenant · iOS bientôt",
        trackTitle: "Enregistrez vos sorties",
        trackText: "Suivez en direct par GPS — distance, allure, splits au km, dénivelé et votre parcours sur une carte.",
        rankTitle: "Grimpez au classement",
        rankText: "Partagez vos sorties et voyez les meilleures allures et distances de votre wilaya.",
        appThemesNote: "Mode clair, sombre ou race — l'application s'adapte à vos préférences.",
        appShotAltLight: "Écran d'accueil de l'app ZidRun en mode clair, avec la recherche de courses.",
        appShotAltDark: "Écran d'accueil de l'app ZidRun en mode sombre, avec la recherche de courses."
      },
      rankings: {
        eyebrow: "Classements",
        title: "Meilleures sorties en Algérie",
        intro: "Découvrez les meilleures allures et les plus longues sorties partagées par les coureurs ZidRun dans chaque wilaya.",
        allWilayas: "Toutes les wilayas",
        wilayaLabel: "Wilaya",
        filter: "Afficher",
        allTime: "Depuis toujours",
        thisMonth: "Ce mois-ci",
        bestPace: "Meilleure allure",
        longestDistance: "Plus longue distance",
        empty: "Aucune sortie publique pour le moment. Partagez une sortie pour apparaître ici.",
        shareCta: "Enregistrer et partager"
      },
      contact: {
        title: "Contactez-nous",
        intro: "Vous avez une question sur ZidRun ? Écrivez-nous et nous vous répondrons dès que possible.",
        emailLabel: "E-mail",
        email: "contact@zidrun.com",
        phoneLabel: "Téléphone",
        phone: "0553 19 17 33",
        whatsappLabel: "WhatsApp",
        whatsapp: "0553 19 17 33",
        hoursLabel: "Heures d'ouverture",
        hours: "Du samedi au jeudi, de 9h00 à 17h00 (heure de l'Algérie)",
        aboutTitle: "À propos",
        aboutLead: "Nous croyons que la santé est le bien le plus précieux qui soit — et que la course à pied est l'un des meilleurs moyens de la préserver.",
        aboutText:
          "C'est cette conviction qui donne vie à ZidRun. Nous tenons à notre communauté et nous voulons voir des personnes en meilleure santé, plus énergiques et pleines de bonne énergie à partager avec leur entourage. Nous avons donc créé un espace pour les coureurs : un lieu où rester motivé, trouver des conseils et apprendre les uns des autres, kilomètre après kilomètre."
      },
      terms: {
        title: "Conditions d'utilisation",
        updated: "Dernière mise à jour : 8 juillet 2026",
        intro:
          "Les présentes Conditions d'utilisation (« Conditions ») régissent votre accès et votre utilisation de ZidRun — notre site web, notre application mobile et les services associés (ensemble, le « Service »). ZidRun est une plateforme pour découvrir des courses de running en Algérie, s'y inscrire, et s'entraîner avec un coach de course IA. En créant un compte ou en utilisant le Service, vous acceptez ces Conditions. Si vous n'êtes pas d'accord, veuillez ne pas utiliser le Service.",
        note:
          "Nous fournissons ces Conditions en anglais, français et arabe à titre de commodité. En cas de conflit entre les versions, la version anglaise prévaut. Ce document est un accord général et ne remplace pas un conseil juridique.",
        sections: [
          {
            id: "acceptance",
            title: "1. Qui nous sommes et acceptation",
            body:
              "ZidRun (« ZidRun », « nous ») exploite le Service en Algérie. Ces Conditions constituent un accord contraignant entre vous et ZidRun.\nVous devez avoir au moins 16 ans pour créer un compte. Si vous avez moins de 18 ans, vous confirmez qu'un parent ou tuteur légal a examiné et accepte ces Conditions et supervise votre utilisation. Si vous utilisez le Service pour le compte d'une organisation, vous confirmez être autorisé à l'engager."
          },
          {
            id: "accounts",
            title: "2. Votre compte",
            body:
              "Vous êtes responsable de la sécurité de vos identifiants et de toute activité sur votre compte. Fournissez des informations exactes et à jour, en particulier lorsqu'une course exige une vérification d'identité. Signalez-nous rapidement toute utilisation non autorisée. Nous pouvons suspendre ou restreindre les comptes qui semblent compromis ou qui enfreignent ces Conditions."
          },
          {
            id: "platform-role",
            title: "3. ZidRun est une plateforme",
            body:
              "Les courses sont créées, gérées et organisées par des organisateurs indépendants. ZidRun fournit des outils qui relient coureurs et organisateurs ; nous ne sommes pas l'organisateur et ne sommes pas partie à votre accord avec un organisateur.\nNous ne contrôlons pas et ne sommes pas responsables de la tenue d'une course, de sa sécurité, de son chronométrage, de ses résultats, de son annulation ou du remboursement de ses frais. Le coach IA fournit uniquement des conseils généraux et automatisés. Nous pouvons retirer tout contenu, annonce ou compte qui enfreint ces Conditions ou la loi."
          },
          {
            id: "race-registration",
            title: "4. Inscription aux courses",
            body:
              "S'inscrire à une course exprime votre intention d'y participer. Une place n'est confirmée que lorsque l'organisateur accepte votre inscription et que tout frais ou document requis est complété. Les organisateurs fixent leurs propres critères, catégories, prix, délais et règles, que vous acceptez de respecter. Vous devez fournir des informations d'identité exactes lorsque cela est requis. Les inscriptions peuvent être annulées selon les règles de l'organisateur ou en cas de non-paiement."
          },
          {
            id: "payments",
            title: "5. Paiements et tarifs",
            body:
              "Les prix sont affichés en dinar algérien (DA). Le paiement est manuel : vous payez les frais de course et les abonnements coach par BaridiMob, CCP, CIB/Edahabia ou tout autre moyen que nous indiquons, et vous téléchargez une preuve de paiement. Nous ne traitons pas de paiements par carte via le Service et ne stockons aucun numéro de carte.\nUn abonnement coach est activé après vérification de votre preuve de paiement. Les frais de course sont collectés selon les indications de l'organisateur. Les prix et formules peuvent changer ; le prix qui vous est indiqué au moment d'un achat s'applique à cet achat."
          },
          {
            id: "coach-subscription",
            title: "6. Abonnement au coach IA",
            body:
              "Chaque nouveau compte inclut un essai gratuit du coach IA (actuellement 7 jours). Après l'essai, l'accès nécessite un abonnement payant (mensuel ou annuel). Un abonnement est une licence personnelle, non transférable et limitée d'utilisation du coach pour sa durée.\nLes abonnements ne se renouvellent pas automatiquement — vous choisissez de vous réabonner pour continuer. L'utilisation peut être soumise à des limites d'usage équitable, et nous pouvons faire évoluer les fonctionnalités ou limites du coach."
          },
          {
            id: "fulfillment",
            title: "7. Exécution (comment le Service est fourni)",
            body:
              "Le Service est fourni de manière numérique.\n• Coach IA : l'accès est accordé à votre compte dès l'activation de votre abonnement après vérification du paiement, et vous pouvez l'utiliser immédiatement pour la durée payée.\n• Inscription aux courses : l'exécution intervient lorsque l'organisateur confirme votre place. Tout ce qui concerne le jour de la course — dossards, chronométrage et l'événement lui-même — est fourni et assuré par l'organisateur, et non par ZidRun.\nComme l'accès numérique est fourni immédiatement à l'activation, vous acceptez que nous puissions commencer à le fournir sans délai."
          },
          {
            id: "refunds",
            title: "8. Politique de remboursement",
            body:
              "L'essai gratuit vous permet d'évaluer le coach IA avant de payer. Une fois un abonnement coach activé, les frais ne sont pas remboursables, sauf lorsqu'un remboursement est exigé par la loi applicable ou accordé par ZidRun à sa discrétion — par exemple un paiement en double ou une erreur de facturation avérée de notre part.\nLes frais d'inscription aux courses sont fixés et collectés selon les règles de chaque organisateur. Les demandes d'annulation ou de remboursement d'une inscription sont décidées par l'organisateur, et non par ZidRun. Pour nous signaler un problème de facturation, écrivez à contact@zidrun.com dans les 14 jours suivant le débit, en joignant votre preuve de paiement."
          },
          {
            id: "ai-health",
            title: "9. Coach IA et votre santé",
            body:
              "Le coach IA fournit uniquement des conseils et informations d'entraînement d'ordre général. Il ne s'agit pas d'un avis médical, sanitaire ou professionnel, et il ne remplace pas un professionnel qualifié. Consultez un médecin avant de commencer ou de modifier tout programme d'entraînement, surtout si vous avez un problème de santé, êtes blessé, êtes enceinte ou n'êtes pas sûr que l'exercice soit sans danger pour vous.\nLa course et l'activité physique comportent des risques inhérents. Vous participez volontairement et à vos propres risques, et vous êtes responsable de vous entraîner dans vos limites et de vous arrêter si vous ne vous sentez pas bien."
          },
          {
            id: "acceptable-use",
            title: "10. Utilisation acceptable",
            body:
              "En utilisant le Service, vous acceptez de ne pas :\n• enfreindre une loi applicable ou les droits de tiers ;\n• publier du contenu faux, trompeur, nuisible, contrefaisant, haineux ou offensant ;\n• usurper l'identité d'autrui ou dénaturer votre identité ou affiliation ;\n• perturber, surcharger, extraire (scraper), désosser ou tenter d'accéder sans autorisation au Service ;\n• détourner les données personnelles d'autres utilisateurs ou envoyer du spam.\nFournissez des informations honnêtes et exactes au coach (y compris les détails de santé). Nous pouvons retirer du contenu et suspendre les comptes qui enfreignent ces règles."
          },
          {
            id: "your-content",
            title: "11. Votre contenu et propriété intellectuelle",
            body:
              "Vous conservez la propriété du contenu que vous soumettez (profil, sorties, messages, données de course). Vous accordez à ZidRun une licence non exclusive, mondiale et gratuite pour héberger, stocker, afficher et traiter ce contenu, uniquement afin d'exploiter, sécuriser et améliorer le Service. Vous êtes responsable de ce que vous soumettez et confirmez en avoir le droit.\nLe nom, le logo, le logiciel et le design de ZidRun appartiennent à ZidRun et sont protégés par la loi. Nous vous accordons une licence limitée, révocable et non transférable d'utilisation du Service à sa finalité prévue ; aucun autre droit n'est accordé."
          },
          {
            id: "third-parties",
            title: "12. Services tiers, disponibilité et modifications",
            body:
              "Le Service repose sur des tiers — par exemple l'hébergement, l'envoi d'e-mails et de notifications push, et les données de cartes et de météo — et peut renvoyer vers des ressources d'organisateurs ou externes. Nous ne sommes pas responsables des services ou contenus tiers, qui peuvent avoir leurs propres conditions.\nNous pouvons ajouter, modifier, suspendre ou interrompre toute partie du Service à tout moment, et celui-ci peut être indisponible pour maintenance ou pour des raisons hors de notre contrôle. Certaines fonctionnalités peuvent être proposées en version d'essai ou bêta."
          },
          {
            id: "warranty",
            title: "13. Exclusion de garanties",
            body:
              "Le Service est fourni « en l'état » et « selon disponibilité », sans garantie d'aucune sorte, expresse, implicite ou légale. Dans toute la mesure permise par la loi, nous excluons toute garantie implicite, y compris de qualité marchande, d'adéquation à un usage particulier, d'absence de contrefaçon, d'exactitude et de fonctionnement ininterrompu ou sans erreur.\nNous ne garantissons pas que les courses, résultats, conseils de coaching, météo ou autres informations du Service soient exacts, complets, à jour ou fiables, et vous vous y fiez à vos propres risques. Certaines juridictions n'autorisent pas certaines exclusions de garantie ; certaines des dispositions ci-dessus peuvent donc ne pas s'appliquer à vous."
          },
          {
            id: "liability",
            title: "14. Limitation de responsabilité",
            body:
              "Dans toute la mesure permise par la loi, ZidRun ainsi que son équipe, ses fournisseurs et partenaires ne sauraient être tenus responsables de dommages indirects, accessoires, spéciaux, consécutifs ou punitifs, ni de toute perte de profits, de données, de clientèle, ni de blessure ou pertes découlant de : votre utilisation ou impossibilité d'utiliser le Service ; des courses organisées par des tiers ; votre confiance dans les conseils de coaching ou autres informations ; ou toute activité physique que vous entreprenez.\nDans toute la mesure permise par la loi, la responsabilité totale cumulée de ZidRun pour toute réclamation liée au Service n'excédera pas le montant le plus élevé entre les sommes que vous avez versées à ZidRun au cours des 3 mois précédant le fait générateur, ou 5 000 DA.\nVous acceptez d'indemniser et de dégager ZidRun de toute réclamation, perte et dépense raisonnable découlant de votre contenu, de votre utilisation du Service ou de votre violation de ces Conditions ou de la loi. Rien dans ces Conditions n'exclut ou ne limite une responsabilité qui ne peut l'être en vertu du droit algérien applicable."
          },
          {
            id: "termination",
            title: "15. Suspension, résiliation et modifications",
            body:
              "Nous pouvons suspendre ou résilier votre accès si vous enfreignez ces Conditions ou la loi, ou si cela est nécessaire pour protéger le Service ou les autres utilisateurs. Vous pouvez cesser d'utiliser le Service et fermer votre compte à tout moment. Les dispositions qui, par leur nature, doivent survivre à la résiliation — notamment les sommes dues, les exclusions, les limites de responsabilité et le droit applicable — continuent de s'appliquer.\nNous pouvons mettre à jour ces Conditions de temps à autre. Nous mettrons à jour la date de « dernière mise à jour » et, pour les changements importants, fournirons un préavis raisonnable. Continuer à utiliser le Service après l'entrée en vigueur des changements vaut acceptation des Conditions mises à jour."
          },
          {
            id: "law",
            title: "16. Droit applicable et litiges",
            body:
              "Ces Conditions sont régies par le droit de la République algérienne démocratique et populaire. Nous chercherons d'abord à résoudre tout litige à l'amiable — veuillez nous contacter. Les litiges qui ne peuvent être résolus à l'amiable relèvent de la compétence exclusive des tribunaux compétents d'Alger, sans préjudice des droits impératifs de protection des consommateurs dont vous bénéficiez en vertu du droit algérien."
          },
          {
            id: "contact",
            title: "17. Contact",
            body:
              "Des questions sur ces Conditions ? Écrivez-nous à contact@zidrun.com, ou depuis votre compte via Compte → Contacter le support."
          }
        ]
      },
      privacy: {
        title: "Politique de confidentialité",
        updated: "Dernière mise à jour : 8 juillet 2026",
        intro:
          "Cette Politique de confidentialité explique quelles données ZidRun collecte, comment nous les utilisons et les choix dont vous disposez. Elle s'applique à notre site web, notre application mobile et les services associés. ZidRun exerce en Algérie et s'engage à ne collecter que ce qui est nécessaire au fonctionnement du Service.",
        note:
          "Nous fournissons cette politique en anglais, français et arabe. En cas de conflit entre les versions, la version anglaise prévaut.",
        sections: [
          {
            id: "data",
            title: "1. Informations que nous collectons",
            body:
              "Nous collectons :\n• Compte et profil : nom, e-mail, téléphone, et des détails facultatifs comme le sexe, la date de naissance, la ville/wilaya, le numéro de pièce d'identité (lorsqu'une course l'exige) et l'avatar.\n• Activité de course : vos inscriptions et tout document requis par un organisateur.\n• Données du coach IA : les informations d'entraînement et de santé que vous choisissez de fournir (objectifs, historique, blessures, problèmes de santé persistants, poids) et, si vous enregistrez des sorties, vos mesures et trajets GPS.\n• Messages : les messages de support que vous nous envoyez.\n• Données organisateur : pour les comptes organisateurs, les coordonnées et détails de l'organisation.\n• Preuve de paiement : la capture d'écran que vous téléchargez pour confirmer un paiement manuel. Nous ne collectons ni ne stockons de numéros de carte.\n• Appareil et usage : données techniques de base (pages consultées approximatives, version de l'application) collectées via notre propre outil d'analyse first-party."
          },
          {
            id: "use",
            title: "2. Comment nous utilisons vos données",
            body:
              "Nous utilisons vos données pour : créer et sécuriser votre compte ; gérer les inscriptions et partager les informations dont les organisateurs ont besoin pour confirmer votre place ; fournir et personnaliser votre coach IA ; envoyer les notifications que vous n'avez pas désactivées ; vérifier les paiements manuels ; mesurer et améliorer le Service ; et le protéger et respecter la loi.\nLe coach IA fournit uniquement des conseils d'entraînement et ne constitue pas un avis médical. Les sorties sont privées par défaut et n'apparaissent dans les classements publics que si vous choisissez de les partager. Nous ne vendons pas vos données personnelles."
          },
          {
            id: "sharing",
            title: "3. Quand nous partageons des données",
            body:
              "Nous partageons des données uniquement lorsque c'est nécessaire au fonctionnement du Service :\n• Les organisateurs reçoivent les détails d'inscription nécessaires pour confirmer et gérer votre participation aux courses auxquelles vous vous inscrivez.\n• Les prestataires traitent des données pour notre compte — par exemple l'hébergement, l'envoi d'e-mails et les notifications push — dans le cadre d'accords limitant leur usage.\n• Loi et sécurité : nous pouvons divulguer des données lorsque la loi l'exige ou pour protéger les droits, la sécurité et la sûreté de ZidRun, de ses utilisateurs ou du public.\nNous ne vendons pas de données personnelles et ne les partageons pas à des fins de publicité tierce."
          },
          {
            id: "cookies",
            title: "4. Cookies et technologies similaires",
            body:
              "Nous utilisons un petit nombre de cookies et technologies similaires. Vous pouvez examiner et accepter ou refuser les cookies non essentiels via la bannière affichée lors de votre première visite, et modifier ou supprimer les cookies à tout moment dans les paramètres de votre navigateur.\n• Essentiel (connexion) : un cookie de session sécurisé défini par notre système d'authentification vous maintient connecté. Le Service ne peut pas fonctionner sans lui ; il ne peut donc pas être désactivé.\n• Préférences : « racedz-locale » enregistre votre langue et « racedz-theme » votre apparence (clair/sombre/course). Chacun dure environ un an.\n• Analyse (first-party) : « zr_vid » (environ un an) et « zr_sid » (environ 30 minutes) sont des identifiants aléatoires servant à mesurer l'usage agrégé, comme le nombre de visiteurs et les pages populaires. Ce sont nos propres cookies — nous n'utilisons pas de cookies publicitaires ou de suivi tiers.\n• Consentement : « zr_consent » mémorise votre choix de cookies pour ne pas vous le redemander.\nNous stockons aussi votre préférence de thème et un indicateur de synchronisation unique dans le stockage local de votre navigateur. Si vous refusez les cookies non essentiels, nous n'utilisons pas de cookies d'analyse. Désactiver les cookies de préférences réinitialise simplement votre langue et votre thème enregistrés."
          },
          {
            id: "retention",
            title: "5. Durée de conservation",
            body:
              "Nous conservons votre compte et ses données tant que votre compte est actif, et aussi longtemps que nécessaire pour fournir le Service, respecter nos obligations légales, résoudre les litiges et faire appliquer nos accords. Les enregistrements d'analyse sont conservés de manière agrégée et les enregistrements bruts plus anciens sont périodiquement purgés. Lorsque vous supprimez votre compte, nous supprimons ou anonymisons vos données personnelles, sauf si la loi nous impose d'en conserver une partie."
          },
          {
            id: "security",
            title: "6. Sécurité",
            body:
              "Nous utilisons des pratiques standard du secteur pour protéger votre compte et vos données : les mots de passe sont hachés, l'accès aux outils d'administration est restreint et les connexions sont chiffrées en transit. Aucun service en ligne ne peut être totalement sécurisé ; utilisez donc un mot de passe fort et unique et gardez vos identifiants en sécurité."
          },
          {
            id: "rights",
            title: "7. Vos droits et choix",
            body:
              "Vous pouvez consulter et mettre à jour la plupart de vos informations, et activer ou désactiver le partage des sorties, depuis votre compte. Vous pouvez gérer les canaux de notification dans vos paramètres, et gérer les cookies via la bannière et votre navigateur.\nVous pouvez demander l'accès à vos données personnelles, leur rectification ou leur suppression, et retirer votre consentement pour les traitements facultatifs. Pour demander la suppression de vos données de coaching et de sorties ou exercer un droit, contactez-nous à hello@zidrun.com. Nous pouvons devoir vérifier votre identité avant de donner suite."
          },
          {
            id: "children",
            title: "8. Enfants",
            body:
              "Le Service n'est pas destiné aux enfants de moins de 16 ans. Si vous avez moins de 18 ans, vous ne devez utiliser le Service qu'avec l'implication d'un parent ou tuteur légal. Si vous pensez qu'un enfant nous a fourni des données personnelles sans le consentement approprié, contactez-nous et nous prendrons des mesures raisonnables pour les supprimer."
          },
          {
            id: "changes",
            title: "9. Modifications et contact",
            body:
              "Nous pouvons mettre à jour cette politique de temps à autre et modifierons la date de « dernière mise à jour » ci-dessus ; pour les changements importants, nous fournirons un préavis raisonnable. Pour toute question ou demande relative à la confidentialité, contactez-nous à hello@zidrun.com."
          }
        ]
      },
      faq: {
        title: "Questions fréquentes",
        intro: "Des réponses rapides sur les courses, les comptes, les paiements et le coach IA. Toujours bloqué ? Discutez avec notre équipe depuis votre compte.",
        items: [
          {
            q: "Qu'est-ce que ZidRun ?",
            a: "ZidRun vous aide à découvrir des courses partout en Algérie, à vous y inscrire, à suivre vos runs et à vous entraîner avec un coach IA personnel — le tout au même endroit."
          },
          {
            q: "Comment m'inscrire à une course ?",
            a: "Ouvrez une course depuis la page Courses, choisissez votre catégorie et suivez les étapes. Un compte est nécessaire, et certaines courses exigent un paiement ou des documents confirmés par l'organisateur."
          },
          {
            q: "ZidRun est-il gratuit ?",
            a: "Parcourir les courses, créer un compte et s'inscrire sont gratuits. Les frais d'inscription sont fixés par chaque organisateur. Le coach IA est gratuit la première semaine, puis nécessite un abonnement."
          },
          {
            q: "Comment fonctionne la semaine gratuite du coach IA ?",
            a: "Chaque nouveau compte bénéficie d'un essai gratuit du coach IA. À la fin, abonnez-vous au mois ou à l'année pour garder vos plans personnalisés, l'analyse de vos runs et le chat de coaching."
          },
          {
            q: "Comment m'abonner au coach et payer ?",
            a: "Allez dans Compte → Abonnement coach, choisissez un plan, payez par BaridiMob ou CCP, puis téléchargez une capture de votre virement. Notre équipe la vérifie et active votre abonnement rapidement."
          },
          {
            q: "Comment changer la langue ou le thème ?",
            a: "Ouvrez votre écran Compte et utilisez les sections Langue et Apparence. Votre choix est enregistré dans votre compte et vous suit lorsque vous vous connectez sur un autre appareil."
          },
          {
            q: "Comment contacter le support ?",
            a: "Allez dans Compte → Contacter le support pour écrire directement à notre équipe. Nous répondrons dans le même chat et vous préviendrons."
          },
          {
            q: "Comment devenir organisateur de courses ?",
            a: "Depuis votre compte, choisissez « Demander un accès organisateur ». Une fois approuvé, vous pourrez publier des courses et gérer les participants depuis le tableau de bord organisateur."
          }
        ]
      },
      cookieBanner: {
        message:
          "Nous utilisons des cookies essentiels pour faire fonctionner ZidRun, ainsi que des cookies optionnels pour mémoriser vos préférences et mesurer l'usage. Vous pouvez accepter ou refuser les cookies optionnels.",
        accept: "Accepter",
        reject: "Refuser les non essentiels",
        learnMore: "Détails des cookies"
      },
      blocked: {
        title: "Votre compte est bloqué",
        message:
          "Votre accès à ZidRun a été suspendu. Si vous pensez qu'il s'agit d'une erreur, veuillez contacter le support et nous vérifierons.",
        contactCta: "Contacter le support",
        backHome: "Retour à l'accueil"
      },
      footerTagline: "Découvrez des courses, inscrivez-vous et entraînez-vous avec un coach IA partout en Algérie.",
      footerRights: "Tous droits réservés.",
      footerDevelopedBy: "Développé par"
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
    account: {
      account: "Compte",
      workspace: "Espace de travail",
      myRegistrations: "Mes inscriptions",
      profileSettings: "Paramètres du profil",
      notifications: "Notifications",
      notificationSettings: "Paramètres des notifications",
      requestOrganizer: "Demander l'accès organisateur",
      organizerDashboard: "Tableau de bord organisateur",
      adminDashboard: "Tableau de bord admin",
      signedOut: "Vous êtes déconnecté",
      signedOutText: "Connectez-vous pour vous inscrire aux courses et utiliser votre coach IA.",
      signIn: "Se connecter",
      signUp: "S'inscrire",
      appearance: "Apparence",
      language: "Langue",
      signOut: "Se déconnecter",
      signingOut: "Déconnexion…",
      themeLight: "Clair",
      themeDark: "Sombre",
      themeRace: "Course",
      back: "Retour",
      profile: "Profil",
      settings: "Paramètres",
      menuLabel: "Menu du compte",
      accountOverview: "Aperçu du compte",
      coach: "Coach IA",
      coachSubscription: "Abonnement coach",
      support: "Contacter le support",
      supportIntro: "Des questions sur les courses, votre compte ou le coach ? Écrivez à l'équipe ZidRun et nous répondrons ici.",
      supportPlaceholder: "Écrivez votre message…",
      supportSend: "Envoyer",
      supportSending: "Envoi…",
      supportEmpty: "Aucun message pour l'instant. Écrivez-nous et nous vous répondrons.",
      supportYou: "Vous",
      supportTeam: "Équipe ZidRun",
      supportLoadError: "Impossible de charger vos messages. Réessayez.",
      supportSendError: "Impossible d'envoyer votre message. Réessayez.",
      supportClosedNote: "Cette conversation a été marquée comme résolue. Envoyez un message pour la rouvrir.",
      welcomeTitle: "Bienvenue sur ZidRun !",
      welcomeIntro: "Configurons votre compte — deux étapes rapides et vous êtes prêt à courir.",
      welcomeProfileTitle: "Complétez votre profil",
      welcomeProfileText: "Ajoutez votre téléphone, votre ville et quelques détails pour que les organisateurs confirment vos inscriptions.",
      welcomeProfileCta: "Remplir mes infos",
      welcomeCoachTitle: "Configurez votre coach IA",
      welcomeCoachText: "Répondez à quelques questions pour un plan d'entraînement personnalisé. Gratuit la première semaine.",
      welcomeCoachCta: "Démarrer le coach",
      welcomeSkip: "Plus tard",
      confirmSignOut: "Confirmer la déconnexion ?",
      signOutError: "Impossible de vous déconnecter. Réessayez."
    },
    profile: {
      eyebrow: "Compte",
      title: "Paramètres du profil",
      intro: "Gardez votre identité de coureur et votre localisation à jour pour une inscription rapide et précise.",
      identity: "Identité",
      firstName: "Prénom",
      lastName: "Nom",
      arabicName: "Nom complet en arabe",
      phone: "Téléphone",
      dateOfBirth: "Date de naissance",
      idNumber: "Numéro de pièce d'identité",
      gender: "Sexe",
      genderUnspecified: "Non précisé",
      genderMale: "Homme",
      genderFemale: "Femme",
      genderOther: "Autre",
      accountEmail: "E-mail du compte",
      location: "Localisation",
      wilaya: "Wilaya",
      city: "Ville",
      commune: "Commune",
      avatar: "Avatar",
      avatarImage: "Image d'avatar",
      saving: "Enregistrement du profil...",
      save: "Enregistrer le profil",
      saveSuccess: "Profil enregistré.",
      validationError: "Vérifiez les champs requis du profil et réessayez.",
      idTaken: "Ce numéro de pièce d'identité est déjà utilisé par un autre compte."
    },
    notifications: {
      eyebrow: "Compte",
      title: "Notifications",
      pageIntro: "Les validations de courses, mises à jour d'inscription, messages d'organisateurs et alertes de compte apparaissent ici.",
      emptyTitle: "Aucune notification pour le moment",
      emptyText: "Les nouvelles mises à jour ZidRun apparaîtront ici lorsqu'il y aura quelque chose à consulter.",
      markAllRead: "Tout marquer comme lu ({count})",
      unread: "Non lu",
      open: "Ouvrir",
      markRead: "Marquer comme lu",
      panelTitle: "Notifications",
      panelSubtitle: "Dernières mises à jour ZidRun",
      panelEmpty: "Aucune mise à jour",
      panelCaughtUp: "Vous êtes à jour.",
      unreadCount: "{count} notifications non lues",
      markReadError: "Impossible de mettre à jour les notifications. Réessayez."
    },
    notificationSettings: {
      eyebrow: "Compte",
      title: "Paramètres des notifications",
      intro:
        "Choisissez quelles mises à jour ZidRun peuvent vous atteindre par e-mail ou push. Les notifications dans l'application restent activées pour l'historique important du compte.",
      columnNotification: "Notification",
      columnEmail: "E-mail",
      columnPush: "Push",
      emailFor: "E-mail pour {name}",
      pushFor: "Push pour {name}",
      save: "Enregistrer les paramètres",
      saved: "Préférences enregistrées."
    },
    registrations: {
      eyebrow: "Compte",
      title: "Mes inscriptions",
      intro: "Suivez vos inscriptions, l'état des paiements et les détails des événements au même endroit.",
      findAnother: "Trouver une autre course",
      savedBanner: "Inscription enregistrée. L'organisateur peut désormais examiner et confirmer votre participation.",
      emptyTitle: "Aucune inscription pour le moment",
      emptyText: "Parcourez les courses ouvertes et inscrivez-vous à la distance qui correspond à votre entraînement.",
      browse: "Parcourir les courses",
      raceDetails: "Détails de la course",
      addDistance: "Ajouter une distance"
    },
    pay: {
      title: "Paiement requis",
      amount: "Montant",
      payVia: "Payer à",
      baridiMob: "BaridiMob",
      ccp: "CCP",
      ccpKey: "clé",
      note: "Note",
      noDetails: "L'organisateur n'a pas encore ajouté de coordonnées de paiement. Contactez-le pour payer.",
      methodLabel: "Comment avez-vous payé ?",
      methodBaridiMob: "BaridiMob",
      methodCcp: "CCP / Algérie Poste",
      proofLabel: "Capture du paiement",
      proofHelp: "Téléversez une capture claire de votre virement pour que l'organisateur puisse le confirmer.",
      submit: "Envoyer la preuve de paiement",
      submitting: "Envoi…",
      underReview: "Preuve envoyée — en attente de confirmation par l'organisateur.",
      resubmit: "Renvoyer la preuve"
    },
    status: {
      PENDING: "En attente",
      CONFIRMED: "Confirmé",
      CANCELLED: "Annulé",
      REJECTED: "Rejeté",
      WAITING_LIST: "Liste d'attente",
      NOT_REQUIRED: "Non requis",
      PAID: "Payé",
      FAILED: "Échoué",
      REFUNDED: "Remboursé",
      MANUAL_REVIEW: "Vérification manuelle"
    },
    auth: {
      loginEyebrow: "Compte ZidRun",
      loginHeadline: "Connectez-vous. Courez vos courses ou organisez vos événements.",
      loginSub: "Une connexion e-mail/mot de passe sécurisée pour les coureurs et les organisations.",
      featRunnersTitle: "Coureurs",
      featRunnersText: "Inscrivez-vous et suivez vos participations.",
      featOrganizersTitle: "Organisateurs",
      featOrganizersText: "Gérez événements et listes.",
      featRaceDaysTitle: "Jours de course",
      featRaceDaysText: "Gardez vos inscriptions prêtes.",
      welcomeBack: "Bon retour",
      signIn: "Se connecter",
      loginCardSub: "Utilisez un compte de démonstration ou vos identifiants ZidRun.",
      or: "ou",
      newRunner: "Nouveau coureur ?",
      createAccount: "Créer un compte",
      emailLabel: "E-mail",
      emailPlaceholder: "coureur@exemple.com",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "racedz-demo-password",
      signingIn: "Connexion...",
      login: "Connexion",
      demoAccounts: "Comptes de démonstration",
      roleRunner: "Coureur",
      roleOrganizer: "Organisateur",
      copied: "Copié",
      copyValue: "Copier {value}",
      activatedNoEmail:
        "Compte créé, mais l'e-mail d'activation n'a pas pu être livré. Contactez le support pour activer ou renvoyer la vérification.",
      activatedCheckEmail: "Compte créé. Consultez votre e-mail et activez votre compte avant de vous connecter.",
      resendPrompt: "Vous n'avez pas reçu l'e-mail ?",
      resend: "Renvoyer l'e-mail de vérification",
      resendSending: "Envoi…",
      resendSent: "Envoyé !",
      resendRetryIn: "Renvoi possible dans {s} s",
      forgotLink: "Mot de passe oublié ?",
      forgotTitle: "Réinitialiser votre mot de passe",
      forgotSubtitle: "Saisissez votre e-mail et nous vous enverrons un lien pour définir un nouveau mot de passe.",
      forgotSubmit: "Envoyer le lien",
      forgotSending: "Envoi…",
      forgotSentTitle: "Vérifiez votre e-mail",
      forgotSentText: "Si un compte existe pour cet e-mail, un lien de réinitialisation est en route. Il expire dans 1 heure.",
      backToLogin: "Retour à la connexion",
      resetTitle: "Choisir un nouveau mot de passe",
      resetSubtitle: "Saisissez un nouveau mot de passe pour votre compte.",
      resetNewPassword: "Nouveau mot de passe",
      resetConfirm: "Confirmer le mot de passe",
      resetSubmit: "Mettre à jour",
      resetInvalid: "Ce lien est invalide ou a expiré. Demandez-en un nouveau.",
      resetInvalidTitle: "Lien expiré",
      resetInvalidText: "Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau pour continuer.",
      resetSuccess: "Mot de passe mis à jour. Vous pouvez maintenant vous connecter.",
      errInvalidInput: "Saisissez un e-mail et un mot de passe valides.",
      errNotActivated: "Consultez votre e-mail et activez votre compte avant de vous connecter.",
      googleSignInError: "La connexion Google n'a pas pu aboutir. Veuillez réessayer.",
      errInvalidCredentials: "E-mail ou mot de passe invalide.",
      registerEyebrow: "Compte coureur",
      registerHeadline: "Créez votre profil ZidRun une fois, puis inscrivez-vous plus vite.",
      registerSub:
        "Votre profil pré-remplit les formulaires de course, garde votre historique au même endroit et aide les organisateurs à vérifier vos informations.",
      registerFeat1Title: "Inscription rapide",
      registerFeat1Text: "Juste votre nom et votre e-mail pour commencer — les détails plus tard.",
      registerFeat2Title: "Prêt quand vous l'êtes",
      registerFeat2Text: "Vos informations pré-remplissent les formulaires lors de l'inscription.",
      registerFeat3Title: "Mises à jour d'inscription",
      registerFeat3Text: "Recevez les confirmations et changements de course.",
      signUpWithGoogle: "S'inscrire avec Google",
      continueWithGoogle: "Continuer avec Google",
      openingGoogle: "Ouverture de Google...",
      coachPromoTitle: "Découvrez votre coach de course IA",
      coachPromoText: "Plans hebdomadaires personnalisés, suivi des sorties et retours du coach.",
      coachPromoCta: "Découvrir le Coach IA",
      orUseEmail: "ou utilisez votre e-mail",
      yourName: "Votre nom",
      yourNameSub: "Juste l'essentiel pour commencer — vous pourrez ajouter le reste plus tard.",
      firstName: "Prénom",
      lastName: "Nom",
      loginSecurity: "Sécurité de connexion",
      loginSecuritySub: "Vous devrez vérifier votre e-mail avant de vous connecter.",
      passwordHint: "Utilisez au moins 8 caractères.",
      hidePassword: "Masquer le mot de passe",
      showPassword: "Afficher le mot de passe",
      confirmPassword: "Confirmer le mot de passe",
      passwordMismatch: "Les mots de passe ne correspondent pas.",
      hideConfirmPassword: "Masquer la confirmation du mot de passe",
      showConfirmPassword: "Afficher la confirmation du mot de passe",
      registerFootnote:
        "Après l'inscription, vérifiez votre e-mail. Vous ajouterez les détails (téléphone, wilaya, pièce d'identité) lors de votre première inscription à une course.",
      creatingAccount: "Création du compte...",
      errTooManySignups: "Trop d'inscriptions depuis ce réseau. Veuillez réessayer plus tard.",
      errCheckFields: "Vérifiez les champs en surbrillance et réessayez.",
      errEmailExists: "Un compte existe déjà avec cet e-mail.",
      errUseDifferentEmail: "Utilisez un autre e-mail ou connectez-vous.",
      verifiedTitle: "Compte activé",
      verifiedText: "Votre e-mail est vérifié. Vous pouvez maintenant vous connecter et vous inscrire aux courses sur ZidRun.",
      goToLogin: "Aller à la connexion",
      verifyExpiredTitle: "Lien de vérification expiré",
      verifyExpiredText:
        "Ce lien d'activation est invalide, expiré ou déjà utilisé. Créez un nouveau compte ou demandez un nouvel e-mail de vérification au support."
    },
    invite: {
      joinTitle: "Rejoindre {organization}",
      invitedBy:
        "{name} vous a invité à aider à gérer les opérations de course sur ZidRun. En acceptant, votre compte rejoint l'organisation avec un accès {role}.",
      invitedEmail: "E-mail invité",
      role: "Rôle",
      organization: "Organisation",
      invited: "Invité le",
      acceptTitle: "Accepter l'accès",
      acceptText: "Connectez-vous avec {email}. Les invitations ne peuvent pas être acceptées depuis un autre compte e-mail.",
      signInToAccept: "Se connecter pour accepter",
      createAccount: "Créer un compte",
      cannotAccept: "Cette invitation ne peut pas être acceptée dans son état actuel.",
      accepting: "Acceptation...",
      acceptInvitation: "Accepter l'invitation"
    },
    ui: {
      page: "Page",
      pageOf: "sur",
      previous: "Précédent",
      next: "Suivant",
      firstPage: "Première page",
      previousPage: "Page précédente",
      nextPage: "Page suivante",
      lastPage: "Dernière page",
      raceImageAlt: "Image de la course {title}",
      from: "À partir de {price}",
      placesAvailable: "{count} places disponibles",
      optional: "facultatif"
    },
    common: {
      view: "Voir"
    }
  },
  ar: {
    nav: {
      races: "السباقات",
      blog: "المدونة",
      organizers: "المنظمون",
      forRunners: "للعدائين",
      aiCoach: "المدرب الذكي",
      pricing: "الأسعار",
      home: "الرئيسية",
      runs: "جرياتي",
      coach: "المدرب",
      account: "حسابي",
      rankings: "التصنيفات",
      admin: "الإدارة",
      about: "من نحن",
      contact: "اتصل بنا",
      terms: "الشروط",
      privacy: "الخصوصية",
      faq: "الأسئلة الشائعة",
      findRace: "ابحث عن سباق",
      login: "تسجيل الدخول",
      signUp: "إنشاء حساب",
      openMenu: "فتح القائمة",
      closeMenu: "إغلاق القائمة"
    },
    home: {
      eyebrow: "ZidRun",
      title: "اكتشف سباقك القادم في الجزائر.",
      subtitle: "ماراثون، 10 كلم، ترايل وسباقات محلية في مكان واحد.",
      findRace: "ابحث عن سباق",
      createEvent: "أنشئ سباقًا",
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
      organizerTitle: "هل تنظّم سباقًا؟",
      organizerText: "أنشئ سباقك وأدِر التسجيلات عبر ZidRun."
    },
    races: {
      eyebrow: "رزنامة السباقات",
      title: "السباقات القادمة في الجزائر",
      resultCount: "{count} سباقات",
      clearFilters: "مسح الفلاتر",
      upcomingOnly: "القادمة فقط",
      showPast: "عرض السباقات السابقة",
      completed: "منتهية",
      emptyTitle: "لا توجد سباقات",
      emptyText: "لا توجد سباقات منشورة بعد. عُد قريبًا.",
      emptyFilteredTitle: "لا توجد سباقات تطابق فلاترك",
      emptyFilteredText: "وسّع بحثك أو امسح الفلاتر.",
      sortLabel: "ترتيب",
      sortDate: "الأقرب",
      sortDistance: "المسافة",
      sortPrice: "السعر",
      filters: "الفلاتر",
      metaTitle: "السباقات",
      metaDescription: "تصفّح سباقات الجري والترايل القادمة في الجزائر."
    },
    raceDetail: {
      registrationCloses: "تُغلق التسجيلات في {date}",
      placesAvailable: "{available} من أصل {total} مقاعد متاحة",
      registerNow: "سجّل الآن",
      registrationClosed: "التسجيلات {status}.",
      categoriesTitle: "المسافات والفئات",
      elevationGain: "{meters} م ارتفاع",
      cutoffTime: "{hours}س حد زمني",
      rulesTitle: "قواعد السباق",
      noRules: "سينشر المنظّم قواعد السباق لاحقًا.",
      documentsTitle: "المستندات المطلوبة",
      noDocuments: "لا توجد مستندات مطلوبة حاليًا.",
      contactTitle: "تواصل",
      organizerLabel: "المنظّم",
      eventElevationGain: "الارتفاع المكتسب",
      conditionsTitle: "شروط السباق",
      announcementsTitle: "إعلانات السباق",
      notFound: "السباق غير موجود",
      raceImageAlt: "صورة سباق {title}",
      platformBadge: "من إنشاء ZidRun",
      yourRegistration: "تسجيلك",
      registeredOn: "تاريخ التسجيل {date}",
      viewRegistration: "عرض تفاصيل التسجيل",
      registerAnother: "تسجيل مسافة أخرى"
    },
    registration: {
      metaTitle: "التسجيل في السباق",
      eyebrow: "التسجيل",
      intro:
        "أكّد مسافتك وجهة الاتصال في حالات الطوارئ. سيُحدّث ملفك الشخصي بمعلومات العدّاء التي تُدخلها هنا.",
      closes: "تُغلق في {date}",
      organizer: "المنظّم",
      distances: "المسافات",
      viewRaceDetails: "عرض تفاصيل السباق",
      notOpen: "التسجيل غير مفتوح لهذا السباق.",
      allRegistered: "أنت مسجّل بالفعل في كل المسافات المتاحة لهذا السباق.",
      runnerDetails: "معلومات العدّاء",
      firstName: "الاسم",
      lastName: "اللقب",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      dateOfBirth: "تاريخ الميلاد",
      gender: "الجنس",
      genderMale: "ذكر",
      genderFemale: "أنثى",
      genderOther: "آخر",
      wilaya: "الولاية",
      city: "المدينة",
      raceSelection: "اختيار السباق",
      distance: "المسافة",
      tshirtSize: "مقاس القميص",
      noPreference: "بدون تفضيل",
      emergencyName: "اسم جهة الاتصال في الطوارئ",
      emergencyPhone: "هاتف جهة الاتصال في الطوارئ",
      club: "النادي أو الفريق",
      acceptRules: "أوافق على قواعد السباق وأؤكّد صحة معلوماتي كمشارك.",
      saving: "جارٍ حفظ التسجيل...",
      complete: "إتمام التسجيل"
    },
    pages: {
      blog: {
        metaTitle: "مدونة الجري — المعدات والتدريب والسباقات في الجزائر",
        metaDescription:
          "أدلة ومراجعات للمعدات ونصائح تدريب للعدّائين في الجزائر — أفضل الأحذية والساعات والإكسسوارات المتوفرة محليًا.",
        eyebrow: "مجلة ZidRun",
        title: "مدونة الجري في الجزائر",
        subtitle: "أدلة المعدات ونصائح التدريب وحيل السباقات — مكتوبة للعدّائين في الجزائر.",
        featured: "مميّز",
        readMore: "اقرأ المقال",
        backToBlog: "كل المقالات",
        minRead: "{n} دقائق قراءة",
        publishedOn: "نُشر في",
        updatedOn: "حُدّث في",
        by: "بقلم",
        relatedTitle: "اقرأ أيضًا",
        allCategories: "الكل",
        empty: "لا توجد مقالات بعد — عد قريبًا.",
        categories: {
          gear: "المعدات",
          training: "التدريب",
          racing: "السباقات",
          nutrition: "التغذية",
          beginner: "المبتدئون"
        }
      },
      about: {
        title: "عن ZidRun",
        intro:
          "ZidRun هو أبسط طريقة لاكتشاف ونشر والتسجيل في سباقات الجري عبر الجزائر. نربط العدائين بسباقات الطريق والترايل والماراثون والفعاليات المجتمعية في مكان واحد.",
        runnersTitle: "للعدائين",
        runnersText:
          "تصفّح الأحداث القادمة، ورشّح حسب الولاية والمسافة ونوع السباق، وسجّل في دقائق. تابع تسجيلاتك من لوحة حسابك.",
        organizersTitle: "للمنظّمين",
        organizersText:
          "اطلب صلاحيات المنظّم، وانشر سباقك، وأدِر الفئات والأسعار، وادعُ فريقك، وتابع المشاركين بقوائم قابلة للتصدير.",
        adminsTitle: "للمدراء",
        adminsText:
          "يراجع المدراء والمدراء العامون المنظمات والسباقات، ويتحكمون في أدوار المستخدمين، ويحافظون على أمان المنصة عبر سجل التدقيق ومسارات الموافقة."
      },
      coachLanding: {
        eyebrow: "مدرب ZidRun",
        title: "مدرب الجري بالذكاء الاصطناعي، مجانًا لمدة 7 أيام.",
        intro:
          "حدّد هدفك، سجّل جلساتك، واحصل على خطة أسبوعية مخصّصة مع ملاحظات — مبنية على تدريبك الفعلي، وليست قالبًا عامًا.",
        trialBadge: "مجانًا لمدة 7 أيام",
        primaryCta: "ابدأ التجربة المجانية 7 أيام",
        primaryCtaMember: "افتح مدرّبك",
        secondaryCta: "تصفّح السباقات",
        trialNote: "بدون بطاقة بنكية. أول 7 أيام من التدريب علينا.",
        featuresTitle: "كل ما يحتاجه تدريبك",
        planTitle: "خطط أسبوعية ذكية",
        planText: "خطة مخصّصة ومتدرّجة بناءً على حجم تدريبك الأخير وتوفّرك — تُعدّل كل أسبوع.",
        runsTitle: "سجّل كل جلسة",
        runsText: "المسافة والوتيرة والإجهاد والملاحظات، أو تتبّع مباشر عبر GPS وخريطة المسار.",
        reviewsTitle: "مراجعات المدرب الذكي",
        reviewsText: "ملاحظات واضحة بعد كل جلسة ومراجعة مركّزة قبل كل أسبوع تدريبي جديد.",
        goalsTitle: "أهداف تناسب حياتك",
        goalsText: "حدّد سباقك المستهدف وتوفّرك الأسبوعي ويوم جلستك الطويلة — يخطّط المدرب حولك.",
        langNote: "تدريب بالعربية أو الفرنسية أو الإنجليزية — حسب اختيارك.",
        howTitle: "كيف يعمل",
        step1Title: "حدّد هدفك",
        step1Text: "أخبر المدرب بسباقك المستهدف ومقدار ما يمكنك التدرّب عليه.",
        step2Title: "سجّل جلساتك",
        step2Text: "أضف كل جلسة أو تتبّعها مباشرة؛ يتعرّف المدرب على لياقتك الحقيقية.",
        step3Title: "احصل على خطتك",
        step3Text: "احصل على خطة أسبوعية ومراجعة مضبوطة على تقدّمك.",
        ctaTitle: "مستعد للجري بذكاء أكبر؟",
        ctaText: "جرّب المدرب الذكي مجانًا لمدة 7 أيام واطّلع على تمرينك القادم اليوم.",
        personalizeTitle: "خطة مصمّمة لك أنت، لا قالب جاهز",
        personalizeText: "يكيّف المدرب كل أسبوع تدريبي وفق شخصك — لياقتك وجسمك وتاريخك وجدول أسبوعك — مع الحفاظ على أمان كل حصة.",
        factorLevelTitle: "مستواك",
        factorLevelText: "سواء كنت تبني قاعدتك الأولى أو تسعى لرقم قياسي، تلتقي بك الخطة حيث أنت تمامًا.",
        factorBodyTitle: "جسمك",
        factorBodyText: "الوزن والطول ونبض الراحة تضبط حِمل التدريب والوتيرة السهلة والاستشفاء.",
        factorInjuryTitle: "تاريخك",
        factorInjuryText: "الإصابات السابقة والأوجاع والملاحظات الصحية تبقي كل حصة متحفّظة ولطيفة على المفاصل.",
        factorScheduleTitle: "أسبوعك",
        factorScheduleText: "أخبره بأيامك المتاحة ويوم جريك الطويل، فتتكيّف الخطة مع حياتك الواقعية.",
        guidanceNote: "يواصل المدرب تعديل خطتك أسبوعًا بعد أسبوع — ويحلّل كل جري — حتى تبلغ الهدف الذي حدّدته منذ اليوم الأول.",
        tipsTitle: "نصائح يومية تناسبك",
        tipsText: "نصائح قصيرة وعملية مطابقة لمستواك وهدفك — واحدة جديدة كلما احتجت دفعة، لا محتوى عامًّا.",
        langTitle: "تدريب بلغتك",
        langText: "كل خطة ومراجعة ونصيحة بالعربية أو الفرنسية أو الإنجليزية — بدّل متى شئت، مع دعم الكتابة من اليمين لليسار."
      },
      organizers: {
        eyebrow: "للمنظّمين",
        title: "انشر السباقات وأدِر المشاركين بعمل يدوي أقل.",
        intro:
          "يوفّر ZidRun للأندية والجمعيات وفرق التنظيم مكانًا واحدًا لنشر تفاصيل السباق، وإدارة الفئات، ودعوة الفريق، وتتبع التسجيلات.",
        primaryCta: "اطلب صلاحية منظّم",
        secondaryCta: "تصفّح السباقات",
        dashboardCta: "افتح لوحة المنظّم",
        reviewNote: "تتم مراجعة صلاحية المنظّم قبل نشر السباقات للعموم.",
        workflowTitle: "ما الذي يمكن للمنظّمين فعله",
        publishTitle: "إنشاء أحداث السباق",
        publishText: "أضف التواريخ والمواقع والفئات والمسافات والأسعار والسعة والقواعد وصور السباق.",
        registrationsTitle: "إدارة التسجيلات",
        registrationsText: "تابع العدائين وحالة الدفع وحالة المشاركة، وصدّر قوائم التسجيل ليوم السباق.",
        teamTitle: "دعوة الفريق",
        teamText: "أضف أعضاء، وعيّن الأدوار، وأعد إرسال الدعوات، وألغِ الوصول المعلّق عند الحاجة.",
        updatesTitle: "إبلاغ التغييرات",
        updatesText: "انشر الإعلانات وأخبر العدائين المسجّلين عند تغيير تفاصيل مهمة في السباق."
      },
      runners: {
        eyebrow: "للعدائين",
        title: "اعثر على سباقك، سجّل في دقائق، وتدرّب مع مدرب ذكاء اصطناعي.",
        intro:
          "يجمع ZidRun كل فعاليات الجري في الجزائر في مكان واحد — اكتشف السباقات، سجّل عبر الإنترنت، تابع تسجيلاتك وخطة تدريب مخصصة.",
        primaryCta: "ابحث عن سباق",
        secondaryCta: "أنشئ حسابك",
        dashboardCta: "تسجيلاتي",
        workflowTitle: "كل ما يحتاجه العدّاء",
        discoverTitle: "اكتشف السباقات",
        discoverText: "تصفّح سباقات الطريق والترايل والمجتمع. رشّح حسب الولاية والمسافة والتاريخ والنوع.",
        registerTitle: "سجّل وتابع",
        registerText: "سجّل عبر الإنترنت في دقائق واحتفظ بكل تسجيلاتك وحالتها في لوحة واحدة.",
        coachTitle: "تدرّب مع المدرب الذكي",
        coachText: "حدد هدفًا، سجّل جرياتك، واحصل على خطة أسبوعية مخصصة وملاحظات بعد الجري بلغتك.",
        remindersTitle: "ابقَ على اطلاع",
        remindersText: "احصل على التأكيدات وتغييرات المواعيد والتذكيرات عبر البريد والإشعارات.",
        appEyebrow: "تطبيق ZidRun",
        appTitle: "خذ ZidRun معك يوم السباق.",
        appText: "يضيف التطبيق ميزات خاصة بالعدائين فوق كل ما في الموقع.",
        appFeature1: "سجّل جرياتك عبر GPS — المسافة والوتيرة والارتفاع وخريطة المسار.",
        appFeature2: "خطة تدريبك وحصتك القادمة دائمًا في جيبك.",
        appFeature3: "تذكيرات فورية لمواعيد التسجيل وبدء السباقات.",
        appBadge: "أندرويد الآن · iOS قريبًا",
        trackTitle: "سجّل جولاتك",
        trackText: "تتبّع مباشرةً عبر GPS — المسافة والوتيرة ومقاطع كل كيلومتر والارتفاع ومسارك على الخريطة.",
        rankTitle: "اصعد في الترتيب",
        rankText: "شارك جولاتك وشاهد أسرع الوتيرات وأطول المسافات في ولايتك.",
        appThemesNote: "وضع فاتح أو داكن أو race — يتكيّف التطبيق مع ما يناسبك.",
        appShotAltLight: "الشاشة الرئيسية لتطبيق ZidRun في الوضع الفاتح، مع البحث عن السباقات.",
        appShotAltDark: "الشاشة الرئيسية لتطبيق ZidRun في الوضع الداكن، مع البحث عن السباقات."
      },
      rankings: {
        eyebrow: "التصنيفات",
        title: "أفضل الجريات في الجزائر",
        intro: "اكتشف أسرع الوتيرات وأطول الجريات التي شاركها عدّاؤو ZidRun في كل ولاية.",
        allWilayas: "كل الولايات",
        wilayaLabel: "الولاية",
        filter: "عرض",
        allTime: "كل الأوقات",
        thisMonth: "هذا الشهر",
        bestPace: "أفضل وتيرة",
        longestDistance: "أطول مسافة",
        empty: "لا توجد جريات علنية بعد. شارك جريًا لتظهر هنا.",
        shareCta: "سجّل وشارك جريًا"
      },
      contact: {
        title: "اتصل بنا",
        intro: "هل لديك سؤال حول ZidRun؟ تواصل معنا وسنرد عليك في أقرب وقت ممكن.",
        emailLabel: "البريد الإلكتروني",
        email: "contact@zidrun.com",
        phoneLabel: "الهاتف",
        phone: "0553 19 17 33",
        whatsappLabel: "واتساب",
        whatsapp: "0553 19 17 33",
        hoursLabel: "ساعات العمل",
        hours: "من السبت إلى الخميس، من 9:00 صباحًا حتى 5:00 مساءً بتوقيت الجزائر",
        aboutTitle: "من نحن",
        aboutLead: "نؤمن بأن الصحة هي أثمن ما يملكه الإنسان، وأن الجري من أفضل الطرق للحفاظ عليها.",
        aboutText:
          "من هذا الإيمان وُلد ZidRun. نحرص على مجتمعنا، ونريد أن نرى أشخاصًا أوفر صحة وأكثر نشاطًا وطاقة إيجابية يشاركونها مع من حولهم. لذلك بنينا مساحة للعدّائين: مكانًا للبقاء متحفّزين، وإيجاد الإرشاد، والتعلّم من بعضهم البعض، كيلومترًا بعد كيلومتر."
      },
      terms: {
        title: "شروط الاستخدام",
        updated: "آخر تحديث: 8 جويلية 2026",
        intro:
          "تحكم شروط الاستخدام هذه («الشروط») وصولك إلى ZidRun واستخدامك له — موقعنا الإلكتروني وتطبيقنا للهاتف والخدمات المرتبطة (معًا «الخدمة»). ZidRun منصّة لاكتشاف سباقات الجري في الجزائر والتسجيل فيها والتدرّب مع مدرب جري ذكي. بإنشائك حسابًا أو استخدامك الخدمة، فإنك توافق على هذه الشروط. إذا لم توافق، فيُرجى عدم استخدام الخدمة.",
        note:
          "نوفّر هذه الشروط بالإنجليزية والفرنسية والعربية لتسهيل الاطلاع. في حال وجود أي تعارض بين النسخ، تسود النسخة الإنجليزية. هذا المستند اتفاق عام ولا يُغني عن استشارة قانونية.",
        sections: [
          {
            id: "acceptance",
            title: "1. من نحن والقبول",
            body:
              "يُشغّل ZidRun («ZidRun»، «نحن») الخدمة في الجزائر. تشكّل هذه الشروط اتفاقًا مُلزمًا بينك وبين ZidRun.\nيجب أن يكون عمرك 16 عامًا على الأقل لإنشاء حساب. إذا كان عمرك دون 18 عامًا، فإنك تؤكّد أنّ أحد الوالدين أو الوصي القانوني قد اطّلع على هذه الشروط ووافق عليها ويشرف على استخدامك. إذا كنت تستخدم الخدمة نيابةً عن مؤسسة، فإنك تؤكّد أنك مخوّل لإلزامها بهذه الشروط."
          },
          {
            id: "accounts",
            title: "2. حسابك",
            body:
              "أنت مسؤول عن الحفاظ على أمان بيانات دخولك وعن كل نشاط يجري عبر حسابك. قدّم معلومات دقيقة ومحدّثة، خاصةً عندما يتطلب سباقٌ التحقق من الهوية. أبلغنا فورًا بأي استخدام غير مصرّح به. يجوز لنا تعليق الحسابات أو تقييدها إذا بدت مخترقة أو مخالفة لهذه الشروط."
          },
          {
            id: "platform-role",
            title: "3. ZidRun منصّة",
            body:
              "تُنشأ السباقات وتُدار وتُنظَّم من قِبل منظّمين مستقلّين. يوفّر ZidRun أدوات تربط العدّائين بالمنظّمين؛ ولسنا المنظّم ولسنا طرفًا في اتفاقك مع المنظّم.\nلا نتحكّم في إقامة السباق أو سلامته أو توقيته أو نتائجه أو إلغائه أو ردّ رسومه ولسنا مسؤولين عن ذلك. يقدّم المدرب الذكي إرشادات عامة وآلية فقط. يجوز لنا إزالة أي محتوى أو إعلان أو حساب يخالف هذه الشروط أو القانون."
          },
          {
            id: "race-registration",
            title: "4. التسجيل في السباقات",
            body:
              "يعبّر التسجيل في سباق عن نيّتك المشاركة. لا يُؤكَّد المقعد إلا عندما يقبل المنظّم تسجيلك وتُستكمل أي رسوم أو مستندات مطلوبة. يضع المنظّمون شروط الأهلية والفئات والأسعار والمواعيد والقواعد الخاصة بهم، وأنت توافق على الالتزام بها. عليك تقديم معلومات هوية دقيقة عند الطلب. قد تُلغى التسجيلات وفق قواعد المنظّم أو بسبب عدم الدفع."
          },
          {
            id: "payments",
            title: "5. المدفوعات والأسعار",
            body:
              "تُعرض الأسعار بالدينار الجزائري (دج). الدفع يدوي: تدفع رسوم السباقات واشتراكات المدرب عبر بريدي موب أو CCP أو CIB/الذهبية أو أي وسيلة أخرى نحددها، وترفع إثبات الدفع. لا نعالج مدفوعات البطاقات عبر الخدمة ولا نخزّن أرقام البطاقات.\nيُفعَّل اشتراك المدرب بعد مراجعة إثبات دفعك. تُحصّل رسوم السباقات وفق توجيهات المنظّم. قد تتغيّر الأسعار والخطط؛ ويُطبَّق على أي عملية شراء السعر المعروض لك وقتها."
          },
          {
            id: "coach-subscription",
            title: "6. اشتراك المدرب الذكي",
            body:
              "يتضمّن كل حساب جديد فترة تجريبية مجانية للمدرب الذكي (حاليًا 7 أيام). بعد الفترة التجريبية، يتطلّب الوصول اشتراكًا مدفوعًا (شهري أو سنوي). الاشتراك ترخيص شخصي غير قابل للتحويل ومحدود لاستخدام المدرب طوال مدّته.\nلا تتجدّد الاشتراكات تلقائيًا — أنت من يختار إعادة الاشتراك للمتابعة. قد يخضع الاستخدام لحدود استعمال عادلة، وقد نغيّر ميزات المدرب أو حدوده مع الوقت."
          },
          {
            id: "fulfillment",
            title: "7. التنفيذ (كيفية تقديم الخدمة)",
            body:
              "تُقدَّم الخدمة رقميًا.\n• المدرب الذكي: يُمنح الوصول لحسابك فور تفعيل اشتراكك بعد مراجعة الدفع، ويمكنك استخدامه فورًا طوال المدة المدفوعة.\n• التسجيل في السباقات: يتحقّق التنفيذ عندما يؤكّد المنظّم مقعدك. أما ما يخصّ يوم السباق — الأرقام والتوقيت والفعالية نفسها — فيقدّمه ويكفله المنظّم لا ZidRun.\nولأنّ الوصول الرقمي يُقدَّم فورًا عند التفعيل، فإنك توافق على أن نبدأ تقديمه دون تأخير."
          },
          {
            id: "refunds",
            title: "8. سياسة الاسترداد",
            body:
              "تتيح لك الفترة التجريبية المجانية تجربة المدرب الذكي قبل الدفع. بعد تفعيل اشتراك المدرب، تصبح الرسوم غير قابلة للاسترداد، إلا حين يوجب القانون المعمول به الاسترداد أو يمنحه ZidRun وفق تقديره — مثل دفعة مكرّرة أو خطأ فوترة مُثبت من جهتنا.\nتُحدَّد رسوم التسجيل في السباقات وتُحصَّل وفق قواعد كل منظّم. طلبات إلغاء أو استرداد التسجيل يقرّرها المنظّم لا ZidRun. لإبلاغنا بمشكلة فوترة، راسل contact@zidrun.com خلال 14 يومًا من الخصم مع إرفاق إثبات الدفع."
          },
          {
            id: "ai-health",
            title: "9. المدرب الذكي وصحتك",
            body:
              "يقدّم المدرب الذكي إرشادات ومعلومات تدريبية عامة فقط. وهو ليس نصيحة طبية أو صحية أو مهنية، ولا يُغني عن مختصّ مؤهّل. استشر طبيبًا قبل بدء أي برنامج تدريبي أو تغييره، خاصةً إذا كان لديك حالة صحية أو إصابة أو كنتِ حاملًا أو لم تكن متأكدًا من أنّ التمرين آمن لك.\nينطوي الجري والنشاط البدني على مخاطر متأصّلة. أنت تشارك طوعًا وعلى مسؤوليتك الخاصة، وأنت مسؤول عن التدرّب ضمن حدودك والتوقّف إذا شعرت بتوعّك."
          },
          {
            id: "acceptable-use",
            title: "10. الاستخدام المقبول",
            body:
              "عند استخدام الخدمة، توافق على ألا:\n• تخالف أي قانون معمول به أو حقوق الغير؛\n• تنشر محتوى كاذبًا أو مضلّلًا أو ضارًا أو منتهِكًا أو كراهيًا أو مسيئًا؛\n• تنتحل شخصية غيرك أو تحرّف هويتك أو انتماءك؛\n• تعطّل الخدمة أو تُثقلها أو تستخرج بياناتها (scraping) أو تفكّكها أو تحاول الوصول غير المصرّح به إليها؛\n• تسيء استخدام بيانات المستخدمين الآخرين أو ترسل بريدًا مزعجًا.\nقدّم معلومات صادقة ودقيقة للمدرب (بما في ذلك التفاصيل الصحية). يجوز لنا إزالة المحتوى وتعليق الحسابات المخالفة لهذه القواعد."
          },
          {
            id: "your-content",
            title: "11. محتواك والملكية الفكرية",
            body:
              "تحتفظ بملكية المحتوى الذي تقدّمه (كالملف الشخصي والجريات والرسائل وبيانات السباق). وتمنح ZidRun ترخيصًا غير حصري وعالميًا ومجانيًا لاستضافة هذا المحتوى وتخزينه وعرضه ومعالجته لغرض تشغيل الخدمة وتأمينها وتحسينها فقط. أنت مسؤول عمّا تقدّمه وتؤكّد أنّ لديك الحق في تقديمه.\nاسم ZidRun وشعاره وبرمجياته وتصميمه ملك لـ ZidRun ومحمي بالقانون. نمنحك ترخيصًا محدودًا وقابلًا للإلغاء وغير قابل للتحويل لاستخدام الخدمة في غرضها المقصود؛ ولا تُمنح أي حقوق أخرى."
          },
          {
            id: "third-parties",
            title: "12. خدمات الغير والتوافر والتغييرات",
            body:
              "تعتمد الخدمة على أطراف ثالثة — مثل الاستضافة، وإرسال البريد الإلكتروني والإشعارات الفورية، وبيانات الخرائط والطقس — وقد تربط بموارد للمنظّمين أو خارجية. لسنا مسؤولين عن خدمات أو محتوى الغير، وقد تكون لها شروطها الخاصة.\nيجوز لنا إضافة أي جزء من الخدمة أو تغييره أو تعليقه أو إيقافه في أي وقت، وقد تكون غير متاحة أثناء الصيانة أو لأسباب خارجة عن إرادتنا. قد تُقدَّم بعض الميزات بصيغة تجريبية أو بيتا."
          },
          {
            id: "warranty",
            title: "13. إخلاء المسؤولية عن الضمانات",
            body:
              "تُقدَّم الخدمة «كما هي» و«حسب توافرها»، دون أي ضمانات من أي نوع، صريحة أو ضمنية أو قانونية. إلى أقصى حدّ يسمح به القانون، نُخلي مسؤوليتنا عن كل الضمانات الضمنية، بما في ذلك القابلية للتسويق والملاءمة لغرض معيّن وعدم الانتهاك والدقة والتشغيل المتواصل أو الخالي من الأخطاء.\nلا نضمن أنّ السباقات أو النتائج أو إرشادات التدريب أو الطقس أو غيرها من المعلومات على الخدمة دقيقة أو كاملة أو محدّثة أو موثوقة، واعتمادك عليها على مسؤوليتك. لا تسمح بعض الولايات القضائية باستثناء بعض الضمانات، لذا قد لا ينطبق بعض ما سبق عليك."
          },
          {
            id: "liability",
            title: "14. تحديد المسؤولية",
            body:
              "إلى أقصى حدّ يسمح به القانون، لن يكون ZidRun وفريقه ومورّدوه وشركاؤه مسؤولين عن أي أضرار غير مباشرة أو عرضية أو خاصة أو تبعية أو عقابية، أو عن أي خسارة في الأرباح أو البيانات أو السمعة، أو عن إصابة أو خسائر ناشئة عن: استخدامك للخدمة أو عدم قدرتك على استخدامها؛ سباقات ينظّمها أطراف ثالثة؛ اعتمادك على إرشادات التدريب أو غيرها من المعلومات؛ أو أي نشاط بدني تقوم به.\nإلى أقصى حدّ يسمح به القانون، لن تتجاوز مسؤولية ZidRun الإجمالية عن كل المطالبات المتعلقة بالخدمة القيمة الأكبر بين ما دفعته لـ ZidRun خلال الأشهر الثلاثة السابقة للحدث المسبّب للمطالبة، أو 5٬000 دج.\nتوافق على تعويض ZidRun وحمايته من المطالبات والخسائر والنفقات المعقولة الناشئة عن محتواك أو استخدامك للخدمة أو مخالفتك لهذه الشروط أو القانون. لا يستثني أي بند في هذه الشروط أو يحدّ من مسؤولية لا يمكن استثناؤها أو تحديدها بموجب القانون الجزائري المعمول به."
          },
          {
            id: "termination",
            title: "15. التعليق والإنهاء وتغيير الشروط",
            body:
              "يجوز لنا تعليق وصولك أو إنهاؤه إذا خالفت هذه الشروط أو القانون، أو عند الحاجة لحماية الخدمة أو المستخدمين الآخرين. ويمكنك التوقّف عن استخدام الخدمة وإغلاق حسابك في أي وقت. تظل البنود التي يقتضي طابعها الاستمرار بعد الإنهاء — بما فيها المبالغ المستحقة وإخلاء المسؤولية وحدود المسؤولية والقانون الحاكم — سارية.\nقد نحدّث هذه الشروط من حين لآخر. سنحدّث تاريخ «آخر تحديث»، وسنقدّم إشعارًا معقولًا بالتغييرات الجوهرية. ويُعدّ استمرارك في استخدام الخدمة بعد سريان التغييرات قبولًا للشروط المحدّثة."
          },
          {
            id: "law",
            title: "16. القانون الحاكم والنزاعات",
            body:
              "تخضع هذه الشروط لقوانين الجمهورية الجزائرية الديمقراطية الشعبية. سنسعى أولًا لحلّ أي نزاع وديًا — يُرجى التواصل معنا. أما النزاعات التي يتعذّر حلّها وديًا فتخضع للاختصاص الحصري للمحاكم المختصة بالجزائر العاصمة، دون المساس بأي حقوق إلزامية لحماية المستهلك تكفلها لك القوانين الجزائرية."
          },
          {
            id: "contact",
            title: "17. التواصل",
            body:
              "أسئلة حول هذه الشروط؟ راسلنا على contact@zidrun.com، أو من حسابك عبر الحساب ← تواصل مع الدعم."
          }
        ]
      },
      privacy: {
        title: "سياسة الخصوصية",
        updated: "آخر تحديث: 8 جويلية 2026",
        intro:
          "توضّح سياسة الخصوصية هذه البيانات التي يجمعها ZidRun وكيف نستخدمها والخيارات المتاحة لك. وهي تسري على موقعنا الإلكتروني وتطبيقنا للهاتف والخدمات المرتبطة. يعمل ZidRun في الجزائر ويلتزم بجمع ما يلزم فقط لتشغيل الخدمة.",
        note:
          "نوفّر هذه السياسة بالإنجليزية والفرنسية والعربية. في حال وجود أي تعارض بين النسخ، تسود النسخة الإنجليزية.",
        sections: [
          {
            id: "data",
            title: "1. المعلومات التي نجمعها",
            body:
              "نجمع:\n• الحساب والملف الشخصي: الاسم والبريد الإلكتروني والهاتف، وتفاصيل اختيارية مثل الجنس وتاريخ الميلاد والمدينة/الولاية ورقم الهوية (عندما يتطلبه سباق) والصورة الرمزية.\n• نشاط السباقات: تسجيلاتك وأي مستندات يطلبها المنظّم.\n• بيانات المدرب الذكي: معلومات التدريب والصحة التي تختار تقديمها (الأهداف، تاريخ التدريب، الإصابات، الحالات الصحية المزمنة، الوزن)، وإذا سجّلت جريات، مقاييسك ومسارات GPS.\n• الرسائل: رسائل الدعم التي ترسلها إلينا.\n• بيانات المنظّم: لحسابات المنظّمين، بيانات الاتصال وتفاصيل المنظمة.\n• إثبات الدفع: لقطة الشاشة التي ترفعها لتأكيد دفعة يدوية. لا نجمع أرقام البطاقات ولا نخزّنها.\n• الجهاز والاستخدام: بيانات تقنية أساسية (كالصفحات المُشاهَدة تقريبًا وإصدار التطبيق) تُجمع عبر أداة تحليلات خاصة بنا (first-party)."
          },
          {
            id: "use",
            title: "2. كيف نستخدم بياناتك",
            body:
              "نستخدم بياناتك لـ: إنشاء حسابك وتأمينه؛ وإدارة التسجيلات ومشاركة ما يحتاجه المنظّمون لتأكيد مقعدك؛ وتوفير مدربك الذكي وتخصيصه؛ وإرسال الإشعارات التي لم توقفها؛ ومراجعة المدفوعات اليدوية؛ وقياس الخدمة وتحسينها؛ والحفاظ على أمانها والامتثال للقانون.\nيقدّم المدرب الذكي إرشادات تدريبية فقط وليس نصيحة طبية. الجريات خاصة افتراضيًا ولا تظهر في التصنيفات العامة إلا إذا اخترت مشاركتها. لا نبيع بياناتك الشخصية."
          },
          {
            id: "sharing",
            title: "3. متى نشارك البيانات",
            body:
              "نشارك البيانات فقط بالقدر اللازم لتشغيل الخدمة:\n• يتلقّى المنظّمون تفاصيل التسجيل اللازمة لتأكيد وإدارة مشاركتك في السباقات التي تسجّل فيها.\n• يعالج مزوّدو الخدمات البيانات نيابةً عنّا — مثل الاستضافة وإرسال البريد والإشعارات الفورية — بموجب اتفاقيات تحدّ من استخدامهم لها.\n• القانون والسلامة: قد نفصح عن البيانات عندما يقتضي القانون ذلك أو لحماية حقوق ZidRun ومستخدميه والجمهور وسلامتهم وأمنهم.\nلا نبيع البيانات الشخصية ولا نشاركها لأغراض الإعلانات الخارجية."
          },
          {
            id: "cookies",
            title: "4. ملفات تعريف الارتباط والتقنيات المشابهة",
            body:
              "نستخدم عددًا محدودًا من ملفات تعريف الارتباط والتقنيات المشابهة. يمكنك مراجعة الملفات غير الأساسية وقبولها أو رفضها عبر الشريط الذي يظهر في زيارتك الأولى، ويمكنك تغيير الملفات أو حذفها في أي وقت من إعدادات متصفّحك.\n• أساسي (تسجيل الدخول): ملف جلسة آمن يضبطه نظام المصادقة لدينا يبقيك مسجّل الدخول. لا تعمل الخدمة بدونه، لذا لا يمكن إيقافه.\n• التفضيلات: «racedz-locale» يحفظ لغتك و«racedz-theme» يحفظ مظهرك (فاتح/داكن/سباق). يدوم كل منهما نحو سنة.\n• التحليلات (first-party): «zr_vid» (نحو سنة) و«zr_sid» (نحو 30 دقيقة) معرّفان عشوائيان نقيس بهما الاستخدام الإجمالي، مثل عدد الزوار والصفحات الأكثر شعبية. هذه ملفاتنا الخاصة — ولا نستخدم ملفات إعلانية أو تتبّعية من أطراف ثالثة.\n• الموافقة: «zr_consent» يتذكّر اختيارك للملفات كي لا نسألك مجددًا.\nنخزّن أيضًا تفضيل مظهرك ومؤشّر مزامنة يُستخدم مرة واحدة في التخزين المحلي لمتصفّحك. إذا رفضت الملفات غير الأساسية، فلن نستخدم ملفات التحليلات. وإيقاف ملفات التفضيلات يعيد ببساطة ضبط لغتك ومظهرك المحفوظين."
          },
          {
            id: "retention",
            title: "5. مدة الاحتفاظ بالبيانات",
            body:
              "نحتفظ بحسابك وبياناته ما دام حسابك نشطًا، وبالقدر اللازم لتقديم الخدمة والوفاء بالالتزامات القانونية وحلّ النزاعات وإنفاذ اتفاقياتنا. تُحفظ سجلات التحليلات بشكل إجمالي وتُقلَّم السجلات الخام الأقدم دوريًا. عند حذف حسابك، نحذف بياناتك الشخصية أو نجعلها مجهولة الهوية، إلا ما يلزمنا القانون بالاحتفاظ به."
          },
          {
            id: "security",
            title: "6. الأمان",
            body:
              "نستخدم ممارسات قياسية في القطاع لحماية حسابك وبياناتك: كلمات المرور مُعمّاة، والوصول إلى أدوات الإدارة مقيّد، والاتصالات مشفّرة أثناء النقل. لا يمكن لأي خدمة على الإنترنت أن تكون آمنة تمامًا، لذا استخدم كلمة مرور قوية وفريدة واحفظ بيانات دخولك."
          },
          {
            id: "rights",
            title: "7. حقوقك وخياراتك",
            body:
              "يمكنك الاطلاع على معظم معلوماتك وتحديثها، وتفعيل أو إيقاف مشاركة الجريات، من حسابك. ويمكنك إدارة قنوات الإشعارات من إعداداتك، وإدارة الملفات عبر الشريط ومتصفّحك.\nيمكنك طلب الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها، وسحب موافقتك على المعالجة الاختيارية. لطلب حذف بيانات التدريب والجريات أو ممارسة أي حق، تواصل معنا على hello@zidrun.com. قد نحتاج إلى التحقق من هويتك قبل تنفيذ الطلب."
          },
          {
            id: "children",
            title: "8. الأطفال",
            body:
              "الخدمة غير موجّهة للأطفال دون 16 عامًا. وإذا كان عمرك دون 18 عامًا، فلا تستخدم الخدمة إلا بمشاركة أحد الوالدين أو الوصي القانوني. إذا كنت تعتقد أنّ طفلًا قد زوّدنا ببيانات شخصية دون الموافقة المناسبة، فتواصل معنا وسنتخذ خطوات معقولة لإزالتها."
          },
          {
            id: "changes",
            title: "9. التغييرات والتواصل",
            body:
              "قد نحدّث هذه السياسة من حين لآخر وسنغيّر تاريخ «آخر تحديث» أعلاه؛ وللتغييرات الجوهرية سنقدّم إشعارًا معقولًا. لأي سؤال أو طلب متعلّق بالخصوصية، تواصل معنا على hello@zidrun.com."
          }
        ]
      },
      faq: {
        title: "الأسئلة الشائعة",
        intro: "إجابات سريعة حول السباقات والحسابات والدفع والمدرب الذكي. ما زلت بحاجة للمساعدة؟ تواصل مع فريقنا من حسابك.",
        items: [
          {
            q: "ما هو ZidRun؟",
            a: "يساعدك ZidRun على اكتشاف سباقات الجري في جميع أنحاء الجزائر، والتسجيل فيها، وتتبّع جرياتك، والتدرّب مع مدرب ذكي شخصي — كل ذلك في مكان واحد."
          },
          {
            q: "كيف أسجّل في سباق؟",
            a: "افتح سباقًا من صفحة السباقات، اختر فئتك، واتبع الخطوات. تحتاج إلى حساب، وبعض السباقات تتطلب دفعًا أو مستندات يؤكدها المنظّم."
          },
          {
            q: "هل ZidRun مجاني؟",
            a: "تصفّح السباقات وإنشاء حساب والتسجيل مجاني. رسوم الاشتراك في السباق يحددها كل منظّم. المدرب الذكي مجاني في الأسبوع الأول ثم يتطلب اشتراكًا."
          },
          {
            q: "كيف يعمل الأسبوع المجاني للمدرب الذكي؟",
            a: "يحصل كل حساب جديد على فترة تجريبية مجانية للمدرب الذكي. عند انتهائها، اشترك شهريًا أو سنويًا للاحتفاظ بخططك المخصصة وتحليل جرياتك ومحادثة التدريب."
          },
          {
            q: "كيف أشترك في المدرب وأدفع؟",
            a: "اذهب إلى الحساب ← اشتراك المدرب، اختر خطة، ادفع عبر بريدي موب أو CCP، ثم ارفع لقطة شاشة للتحويل. يراجعها فريقنا ويفعّل اشتراكك قريبًا."
          },
          {
            q: "كيف أغيّر اللغة أو المظهر؟",
            a: "افتح شاشة الحساب واستخدم قسمي اللغة والمظهر. يُحفظ اختيارك في حسابك ويتبعك عند تسجيل الدخول من جهاز آخر."
          },
          {
            q: "كيف أتواصل مع الدعم؟",
            a: "اذهب إلى الحساب ← تواصل مع الدعم لمراسلة فريقنا مباشرة. سنرد في المحادثة نفسها وننبّهك عند الرد."
          },
          {
            q: "كيف أصبح منظّم سباقات؟",
            a: "من حسابك، اختر «طلب صلاحية منظّم». بعد الموافقة، يمكنك نشر السباقات وإدارة المشاركين من لوحة المنظّم."
          }
        ]
      },
      cookieBanner: {
        message:
          "نستخدم ملفات تعريف ارتباط أساسية لتشغيل ZidRun، وأخرى اختيارية لتذكّر تفضيلاتك وقياس الاستخدام. يمكنك قبول الاختيارية أو رفضها.",
        accept: "قبول",
        reject: "رفض غير الأساسية",
        learnMore: "تفاصيل الملفات"
      },
      blocked: {
        title: "حسابك محظور",
        message:
          "تم تعليق وصولك إلى ZidRun. إذا كنت تعتقد أنّ هذا خطأ، يُرجى التواصل مع الدعم وسنراجع الأمر.",
        contactCta: "تواصل مع الدعم",
        backHome: "العودة إلى الرئيسية"
      },
      footerTagline: "اكتشف السباقات، سجّل، وتدرّب مع مدرب ذكي في الجزائر.",
      footerRights: "جميع الحقوق محفوظة.",
      footerDevelopedBy: "تطوير"
    },
    search: {
      keyword: "سباق، مدينة، منظّم",
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
    account: {
      account: "الحساب",
      workspace: "مساحة العمل",
      myRegistrations: "تسجيلاتي",
      profileSettings: "إعدادات الملف الشخصي",
      notifications: "الإشعارات",
      notificationSettings: "إعدادات الإشعارات",
      requestOrganizer: "طلب صلاحية منظّم",
      organizerDashboard: "لوحة المنظّم",
      adminDashboard: "لوحة الإدارة",
      signedOut: "أنت غير مسجّل الدخول",
      signedOutText: "سجّل الدخول للتسجيل في السباقات واستخدام مدربك الذكي.",
      signIn: "تسجيل الدخول",
      signUp: "إنشاء حساب",
      appearance: "المظهر",
      language: "اللغة",
      signOut: "تسجيل الخروج",
      signingOut: "جارٍ تسجيل الخروج…",
      themeLight: "فاتح",
      themeDark: "داكن",
      themeRace: "سباق",
      back: "رجوع",
      profile: "الملف الشخصي",
      settings: "الإعدادات",
      menuLabel: "قائمة الحساب",
      accountOverview: "نظرة عامة على الحساب",
      coach: "مدرب الذكاء الاصطناعي",
      coachSubscription: "اشتراك المدرب",
      support: "تواصل مع الدعم",
      supportIntro: "لديك أسئلة حول السباقات أو حسابك أو المدرب؟ راسل فريق ZidRun وسنرد عليك هنا.",
      supportPlaceholder: "اكتب رسالتك…",
      supportSend: "إرسال",
      supportSending: "جارٍ الإرسال…",
      supportEmpty: "لا توجد رسائل بعد. راسلنا وسنرد عليك.",
      supportYou: "أنت",
      supportTeam: "فريق ZidRun",
      supportLoadError: "تعذّر تحميل رسائلك. حاول مرة أخرى.",
      supportSendError: "تعذّر إرسال رسالتك. حاول مرة أخرى.",
      supportClosedNote: "تم وضع علامة على هذه المحادثة كمحلولة. أرسل رسالة لإعادة فتحها.",
      welcomeTitle: "مرحبًا بك في ZidRun!",
      welcomeIntro: "لنُعدّ حسابك — خطوتان سريعتان وتصبح جاهزًا للجري.",
      welcomeProfileTitle: "أكمل ملفك الشخصي",
      welcomeProfileText: "أضف رقم هاتفك ومدينتك وبعض التفاصيل ليتمكن المنظمون من تأكيد تسجيلاتك.",
      welcomeProfileCta: "إكمال معلوماتي",
      welcomeCoachTitle: "أعدّ مدربك الذكي",
      welcomeCoachText: "أجب عن بعض الأسئلة للحصول على خطة تدريب مخصصة. مجانًا في أسبوعك الأول.",
      welcomeCoachCta: "ابدأ المدرب",
      welcomeSkip: "لاحقًا",
      confirmSignOut: "تأكيد تسجيل الخروج؟",
      signOutError: "تعذّر تسجيل خروجك. حاول مرة أخرى."
    },
    profile: {
      eyebrow: "الحساب",
      title: "إعدادات الملف الشخصي",
      intro: "حافظ على تحديث هويتك كعدّاء وموقعك ليبقى التسجيل في السباقات سريعًا ودقيقًا.",
      identity: "الهوية",
      firstName: "الاسم",
      lastName: "اللقب",
      arabicName: "الاسم الكامل بالعربية",
      phone: "الهاتف",
      dateOfBirth: "تاريخ الميلاد",
      idNumber: "رقم بطاقة التعريف",
      gender: "الجنس",
      genderUnspecified: "غير محدد",
      genderMale: "ذكر",
      genderFemale: "أنثى",
      genderOther: "آخر",
      accountEmail: "بريد الحساب",
      location: "الموقع",
      wilaya: "الولاية",
      city: "المدينة",
      commune: "البلدية",
      avatar: "الصورة الرمزية",
      avatarImage: "صورة رمزية",
      saving: "جارٍ حفظ الملف...",
      save: "حفظ إعدادات الملف",
      saveSuccess: "تم حفظ إعدادات الملف.",
      validationError: "تحقّق من الحقول المطلوبة في الملف وأعد المحاولة.",
      idTaken: "رقم بطاقة التعريف هذا مستخدم بالفعل من حساب آخر."
    },
    notifications: {
      eyebrow: "الحساب",
      title: "الإشعارات",
      pageIntro: "تظهر هنا موافقات السباقات وتحديثات التسجيل ورسائل المنظّمين وتنبيهات الحساب.",
      emptyTitle: "لا توجد إشعارات بعد",
      emptyText: "ستظهر تحديثات ZidRun الجديدة هنا عندما يكون هناك ما يستدعي مراجعتك.",
      markAllRead: "تحديد الكل كمقروء ({count})",
      unread: "غير مقروء",
      open: "فتح",
      markRead: "تحديد كمقروء",
      panelTitle: "الإشعارات",
      panelSubtitle: "آخر تحديثات ZidRun",
      panelEmpty: "لا توجد تحديثات",
      panelCaughtUp: "أنت على اطّلاع بكل شيء.",
      unreadCount: "{count} إشعارات غير مقروءة",
      markReadError: "تعذّر تحديث الإشعارات. حاول مرة أخرى."
    },
    notificationSettings: {
      eyebrow: "الحساب",
      title: "إعدادات الإشعارات",
      intro:
        "اختر تحديثات ZidRun التي يمكن أن تصلك عبر البريد أو الإشعارات الفورية. تبقى إشعارات التطبيق مفعّلة لسجل الحساب المهم.",
      columnNotification: "الإشعار",
      columnEmail: "البريد",
      columnPush: "فوري",
      emailFor: "بريد لـ {name}",
      pushFor: "إشعار فوري لـ {name}",
      save: "حفظ الإعدادات",
      saved: "تم حفظ التفضيلات."
    },
    registrations: {
      eyebrow: "الحساب",
      title: "تسجيلاتي",
      intro: "تابع تسجيلاتك وحالة الدفع وتفاصيل الأحداث في مكان واحد.",
      findAnother: "ابحث عن سباق آخر",
      savedBanner: "تم حفظ التسجيل. يمكن للمنظّم الآن مراجعة مشاركتك وتأكيدها.",
      emptyTitle: "لا توجد تسجيلات بعد",
      emptyText: "تصفّح السباقات المفتوحة وسجّل في المسافة التي تناسب تدريبك.",
      browse: "تصفّح السباقات",
      raceDetails: "تفاصيل السباق",
      addDistance: "إضافة مسافة"
    },
    pay: {
      title: "الدفع مطلوب",
      amount: "المبلغ",
      payVia: "ادفع إلى",
      baridiMob: "بريدي موب",
      ccp: "CCP",
      ccpKey: "المفتاح",
      note: "ملاحظة",
      noDetails: "لم يضِف المنظّم بيانات الدفع بعد. تواصل معه لإتمام الدفع.",
      methodLabel: "كيف دفعت؟",
      methodBaridiMob: "بريدي موب",
      methodCcp: "CCP / بريد الجزائر",
      proofLabel: "لقطة شاشة للدفع",
      proofHelp: "حمّل لقطة واضحة لعملية التحويل ليتمكّن المنظّم من تأكيدها.",
      submit: "إرسال إثبات الدفع",
      submitting: "جارٍ الإرسال…",
      underReview: "تم إرسال الإثبات — في انتظار تأكيد المنظّم للدفع.",
      resubmit: "إعادة رفع الإثبات"
    },
    status: {
      PENDING: "قيد الانتظار",
      CONFIRMED: "مؤكّد",
      CANCELLED: "ملغى",
      REJECTED: "مرفوض",
      WAITING_LIST: "قائمة الانتظار",
      NOT_REQUIRED: "غير مطلوب",
      PAID: "مدفوع",
      FAILED: "فشل",
      REFUNDED: "مسترجع",
      MANUAL_REVIEW: "مراجعة يدوية"
    },
    auth: {
      loginEyebrow: "حساب ZidRun",
      loginHeadline: "سجّل الدخول مرة واحدة. اركض سباقاتك أو نظّم فعالياتك.",
      loginSub: "تسجيل دخول آمن واحد بالبريد وكلمة المرور للعدائين والمنظمات.",
      featRunnersTitle: "العداؤون",
      featRunnersText: "سجّل وتابع مشاركاتك.",
      featOrganizersTitle: "المنظّمون",
      featOrganizersText: "أدِر الفعاليات والقوائم.",
      featRaceDaysTitle: "أيام السباق",
      featRaceDaysText: "أبقِ تسجيلاتك جاهزة.",
      welcomeBack: "مرحبًا بعودتك",
      signIn: "تسجيل الدخول",
      loginCardSub: "استخدم حساب تجربة أو بيانات ZidRun الخاصة بك.",
      or: "أو",
      newRunner: "عدّاء جديد؟",
      createAccount: "إنشاء حساب",
      emailLabel: "البريد الإلكتروني",
      emailPlaceholder: "coureur@exemple.com",
      passwordLabel: "كلمة المرور",
      passwordPlaceholder: "racedz-demo-password",
      signingIn: "جارٍ تسجيل الدخول...",
      login: "تسجيل الدخول",
      demoAccounts: "حسابات التجربة",
      roleRunner: "عدّاء",
      roleOrganizer: "منظّم",
      copied: "تم النسخ",
      copyValue: "نسخ {value}",
      activatedNoEmail:
        "تم إنشاء الحساب، لكن تعذّر إرسال بريد التفعيل. تواصل مع الدعم للتفعيل أو إعادة إرسال التحقق.",
      activatedCheckEmail: "تم إنشاء الحساب. تحقّق من بريدك وفعّل حسابك قبل تسجيل الدخول.",
      resendPrompt: "لم يصلك البريد؟",
      resend: "إعادة إرسال بريد التحقق",
      resendSending: "جارٍ الإرسال…",
      resendSent: "تم الإرسال!",
      resendRetryIn: "إعادة الإرسال بعد {s} ثانية",
      forgotLink: "نسيت كلمة المرور؟",
      forgotTitle: "إعادة تعيين كلمة المرور",
      forgotSubtitle: "أدخل بريدك الإلكتروني وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.",
      forgotSubmit: "إرسال الرابط",
      forgotSending: "جارٍ الإرسال…",
      forgotSentTitle: "تحقّق من بريدك",
      forgotSentText: "إذا كان هناك حساب بهذا البريد، فالرابط في طريقه إليك. تنتهي صلاحيته خلال ساعة.",
      backToLogin: "العودة لتسجيل الدخول",
      resetTitle: "اختر كلمة مرور جديدة",
      resetSubtitle: "أدخل كلمة مرور جديدة لحسابك.",
      resetNewPassword: "كلمة المرور الجديدة",
      resetConfirm: "تأكيد كلمة المرور",
      resetSubmit: "تحديث كلمة المرور",
      resetInvalid: "هذا الرابط غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.",
      resetInvalidTitle: "انتهت صلاحية الرابط",
      resetInvalidText: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا للمتابعة.",
      resetSuccess: "تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.",
      errInvalidInput: "أدخل بريدًا وكلمة مرور صحيحين.",
      errNotActivated: "تحقّق من بريدك وفعّل حسابك قبل تسجيل الدخول.",
      googleSignInError: "تعذّر إكمال تسجيل الدخول عبر Google. يُرجى المحاولة مرة أخرى.",
      errInvalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      registerEyebrow: "حساب عدّاء",
      registerHeadline: "أنشئ ملف ZidRun مرة واحدة، ثم سجّل أسرع.",
      registerSub:
        "يملأ ملفك نماذج السباقات مسبقًا، ويحفظ سجل تسجيلاتك في مكان واحد، ويساعد المنظّمين على التحقق من معلوماتك.",
      registerFeat1Title: "تسجيل سريع",
      registerFeat1Text: "فقط اسمك وبريدك للبدء — أضف التفاصيل لاحقًا.",
      registerFeat2Title: "جاهز عندما تكون مستعدًا",
      registerFeat2Text: "تملأ معلوماتك نماذج السباق مسبقًا عند التسجيل.",
      registerFeat3Title: "تحديثات التسجيل",
      registerFeat3Text: "استقبل تأكيدات السباق وتغييراته.",
      signUpWithGoogle: "التسجيل عبر Google",
      continueWithGoogle: "المتابعة عبر Google",
      openingGoogle: "جارٍ فتح Google...",
      coachPromoTitle: "تعرّف على مدرب الجري الذكي",
      coachPromoText: "خطط أسبوعية مخصّصة، وتتبّع الجلسات، وملاحظات المدرب.",
      coachPromoCta: "اكتشف المدرب الذكي",
      orUseEmail: "أو استخدم البريد الإلكتروني",
      yourName: "اسمك",
      yourNameSub: "الأساسيات فقط للبدء — يمكنك إضافة البقية لاحقًا.",
      firstName: "الاسم",
      lastName: "اللقب",
      loginSecurity: "أمان الدخول",
      loginSecuritySub: "ستحتاج إلى التحقق من بريدك قبل تسجيل الدخول.",
      passwordHint: "استخدم 8 أحرف على الأقل.",
      hidePassword: "إخفاء كلمة المرور",
      showPassword: "إظهار كلمة المرور",
      confirmPassword: "تأكيد كلمة المرور",
      passwordMismatch: "كلمتا المرور غير متطابقتين.",
      hideConfirmPassword: "إخفاء تأكيد كلمة المرور",
      showConfirmPassword: "إظهار تأكيد كلمة المرور",
      registerFootnote:
        "بعد التسجيل، تحقّق من بريدك. ستضيف التفاصيل (الهاتف، الولاية، بطاقة التعريف) عند تسجيلك في أول سباق.",
      creatingAccount: "جارٍ إنشاء الحساب...",
      errTooManySignups: "عدد كبير من التسجيلات من هذه الشبكة. يرجى المحاولة لاحقًا.",
      errCheckFields: "تحقّق من الحقول المميّزة وأعد المحاولة.",
      errEmailExists: "يوجد حساب بهذا البريد الإلكتروني بالفعل.",
      errUseDifferentEmail: "استخدم بريدًا آخر أو سجّل الدخول.",
      verifiedTitle: "تم تفعيل الحساب",
      verifiedText: "تم التحقق من بريدك. يمكنك الآن تسجيل الدخول والتسجيل في السباقات على ZidRun.",
      goToLogin: "الذهاب إلى تسجيل الدخول",
      verifyExpiredTitle: "انتهت صلاحية رابط التحقق",
      verifyExpiredText:
        "رابط التفعيل هذا غير صالح أو منتهي أو مستخدم بالفعل. أنشئ حسابًا جديدًا أو اطلب بريد تحقق جديدًا من الدعم."
    },
    invite: {
      joinTitle: "انضمّ إلى {organization}",
      invitedBy:
        "دعاك {name} للمساعدة في إدارة عمليات السباق على ZidRun. بقبولك، يُضاف حسابك إلى المنظمة بصلاحية {role}.",
      invitedEmail: "البريد المدعوّ",
      role: "الدور",
      organization: "المنظمة",
      invited: "تاريخ الدعوة",
      acceptTitle: "قبول الوصول",
      acceptText: "سجّل الدخول بـ {email}. لا يمكن قبول الدعوات من حساب بريد مختلف.",
      signInToAccept: "سجّل الدخول للقبول",
      createAccount: "إنشاء حساب",
      cannotAccept: "لا يمكن قبول هذه الدعوة في حالتها الحالية.",
      accepting: "جارٍ القبول...",
      acceptInvitation: "قبول الدعوة"
    },
    ui: {
      page: "صفحة",
      pageOf: "من",
      previous: "السابق",
      next: "التالي",
      firstPage: "الصفحة الأولى",
      previousPage: "الصفحة السابقة",
      nextPage: "الصفحة التالية",
      lastPage: "الصفحة الأخيرة",
      raceImageAlt: "صورة سباق {title}",
      from: "ابتداءً من {price}",
      placesAvailable: "{count} مقاعد متاحة",
      optional: "اختياري"
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
