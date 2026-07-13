// Long-form policy / FAQ content, split out of i18n.ts so it stays in the SERVER bundle only.
// The public content pages (terms, privacy, faq) import this; no client component does, so
// these ~640 lines of trilingual text never ship in the shared client chunk. See i18n.ts.
import type { Locale } from "@/lib/i18n";

export const contentDictionaries = {
  en: {
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
  },
  fr: {
      terms: {
        title: "Conditions d'utilisation",
        updated: "Dernière mise à jour : 8 juillet 2026",
        intro:
          "Les présentes Conditions d'utilisation (« Conditions ») régissent votre accès et votre utilisation de ZidRun — notre site web, notre application mobile et les services associés (ensemble, le « Service »). ZidRun est une plateforme qui permet de découvrir des courses à pied en Algérie, de s'y inscrire et de s'entraîner avec un coach de course doté d'IA. En créant un compte ou en utilisant le Service, vous acceptez ces Conditions. Si vous n'êtes pas d'accord, veuillez ne pas utiliser le Service.",
        note:
          "Nous fournissons ces Conditions en anglais, français et arabe à titre de commodité. En cas de conflit entre les versions, la version anglaise prévaut. Ce document est un accord général et ne remplace pas un conseil juridique.",
        sections: [
          {
            id: "acceptance",
            title: "1. Qui nous sommes et acceptation",
            body:
              "ZidRun (« ZidRun », « nous ») exploite le Service en Algérie. Ces Conditions constituent un accord contraignant entre vous et ZidRun.\nVous devez avoir au moins 16 ans pour créer un compte. Si vous avez moins de 18 ans, vous confirmez qu'un parent ou tuteur légal a examiné et accepte ces Conditions et supervise votre utilisation. Si vous utilisez le Service pour le compte d'une organisation, vous confirmez être autorisé à l'engager juridiquement."
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
              "En utilisant le Service, vous acceptez de ne pas :\n• enfreindre une loi applicable ou les droits de tiers ;\n• publier du contenu faux, trompeur, nuisible, contrefaisant, haineux ou offensant ;\n• usurper l'identité d'autrui ou dénaturer votre identité ou affiliation ;\n• perturber, surcharger, extraire des données, désosser ou tenter d'accéder sans autorisation au Service ;\n• détourner les données personnelles d'autres utilisateurs ou envoyer des messages indésirables.\nFournissez des informations honnêtes et exactes au coach (y compris les détails de santé). Nous pouvons retirer du contenu et suspendre les comptes qui enfreignent ces règles."
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
              "Nous collectons :\n• Compte et profil : nom, e-mail, téléphone, et des détails facultatifs comme le sexe, la date de naissance, la ville ou la wilaya, le numéro de pièce d'identité (lorsqu'une course l'exige) et la photo de profil.\n• Activité de course : vos inscriptions et tout document requis par un organisateur.\n• Données du coach IA : les informations d'entraînement et de santé que vous choisissez de fournir (objectifs, historique, blessures, problèmes de santé persistants, poids) et, si vous enregistrez des sorties, vos mesures et trajets GPS.\n• Messages : les messages de support que vous nous envoyez.\n• Données organisateur : pour les comptes organisateurs, les coordonnées et détails de l'organisation.\n• Preuve de paiement : la capture d'écran que vous téléchargez pour confirmer un paiement manuel. Nous ne collectons ni ne stockons de numéros de carte.\n• Appareil et usage : données techniques de base (pages consultées approximatives, version de l'application) collectées via notre propre outil d'analyse interne."
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
              "Nous utilisons un petit nombre de cookies et technologies similaires. Vous pouvez examiner et accepter ou refuser les cookies non essentiels via la bannière affichée lors de votre première visite, et modifier ou supprimer les cookies à tout moment dans les paramètres de votre navigateur.\n• Essentiel (connexion) : un cookie de session sécurisé défini par notre système d'authentification vous maintient connecté. Le Service ne peut pas fonctionner sans lui ; il ne peut donc pas être désactivé.\n• Préférences : « racedz-locale » enregistre votre langue et « racedz-theme » votre apparence (clair/sombre/course). Chacun dure environ un an.\n• Analyse interne : « zr_vid » (environ un an) et « zr_sid » (environ 30 minutes) sont des identifiants aléatoires servant à mesurer l'usage agrégé, comme le nombre de visiteurs et les pages populaires. Ce sont nos propres cookies — nous n'utilisons pas de cookies publicitaires ou de suivi tiers.\n• Consentement : « zr_consent » mémorise votre choix de cookies pour ne pas vous le redemander.\nNous stockons aussi votre préférence de thème et un indicateur de synchronisation unique dans le stockage local de votre navigateur. Si vous refusez les cookies non essentiels, nous n'utilisons pas de cookies d'analyse. Désactiver les cookies de préférences réinitialise simplement votre langue et votre thème enregistrés."
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
  },
  ar: {
      terms: {
        title: "شروط الاستخدام",
        updated: "آخر تحديث: 8 جويلية 2026",
        intro:
          "تحكم شروط الاستخدام هذه («الشروط») وصولك إلى ZidRun واستخدامك له — موقعنا الإلكتروني وتطبيقنا للهاتف والخدمات المرتبطة (معًا «الخدمة»). ZidRun منصّة لاكتشاف سباقات الجري في الجزائر والتسجيل فيها والتدرّب مع مدرب جري يعمل بالذكاء الاصطناعي. بإنشائك حسابًا أو استخدامك الخدمة، فإنك توافق على هذه الشروط. إذا لم توافق، فيُرجى عدم استخدام الخدمة.",
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
              "يعبّر التسجيل في سباق عن نيّتك المشاركة. لا يُؤكَّد مكانك إلا عندما يقبل المنظّم تسجيلك وتُستكمل أي رسوم أو مستندات مطلوبة. يضع المنظّمون شروط الأهلية والفئات والأسعار والمواعيد والقواعد الخاصة بهم، وأنت توافق على الالتزام بها. عليك تقديم معلومات هوية دقيقة عند الطلب. قد تُلغى التسجيلات وفق قواعد المنظّم أو بسبب عدم الدفع."
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
              "تُقدَّم الخدمة رقميًا.\n• المدرب الذكي: يُمنح الوصول لحسابك فور تفعيل اشتراكك بعد مراجعة الدفع، ويمكنك استخدامه فورًا طوال المدة المدفوعة.\n• التسجيل في السباقات: يتحقّق التنفيذ عندما يؤكّد المنظّم مكانك. أما ما يخصّ يوم السباق — الأرقام والتوقيت والفعالية نفسها — فيقدّمه ويكفله المنظّم لا ZidRun.\nولأنّ الوصول الرقمي يُقدَّم فورًا عند التفعيل، فإنك توافق على أن نبدأ تقديمه دون تأخير."
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
              "عند استخدام الخدمة، توافق على ألا:\n• تخالف أي قانون معمول به أو حقوق الغير؛\n• تنشر محتوى كاذبًا أو مضلّلًا أو ضارًا أو منتهِكًا أو كراهيًا أو مسيئًا؛\n• تنتحل شخصية غيرك أو تحرّف هويتك أو انتماءك؛\n• تعطّل الخدمة أو تُثقلها أو تستخرج بياناتها أو تفكّكها أو تحاول الوصول غير المصرّح به إليها؛\n• تسيء استخدام بيانات المستخدمين الآخرين أو ترسل رسائل مزعجة.\nقدّم معلومات صادقة ودقيقة للمدرب (بما في ذلك التفاصيل الصحية). يجوز لنا إزالة المحتوى وتعليق الحسابات المخالفة لهذه القواعد."
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
              "نجمع:\n• الحساب والملف الشخصي: الاسم والبريد الإلكتروني والهاتف، وتفاصيل اختيارية مثل الجنس وتاريخ الميلاد والمدينة أو الولاية ورقم الهوية (عندما يتطلبه سباق) وصورة الملف الشخصي.\n• نشاط السباقات: تسجيلاتك وأي مستندات يطلبها المنظّم.\n• بيانات المدرب الذكي: معلومات التدريب والصحة التي تختار تقديمها (الأهداف، تاريخ التدريب، الإصابات، الحالات الصحية المزمنة، الوزن)، وإذا سجّلت جريات، مقاييسك ومسارات GPS.\n• الرسائل: رسائل الدعم التي ترسلها إلينا.\n• بيانات المنظّم: لحسابات المنظّمين، بيانات الاتصال وتفاصيل المنظمة.\n• إثبات الدفع: لقطة الشاشة التي ترفعها لتأكيد دفعة يدوية. لا نجمع أرقام البطاقات ولا نخزّنها.\n• الجهاز والاستخدام: بيانات تقنية أساسية (كالصفحات المُشاهَدة تقريبًا وإصدار التطبيق) تُجمع عبر أداة تحليلات داخلية."
          },
          {
            id: "use",
            title: "2. كيف نستخدم بياناتك",
            body:
              "نستخدم بياناتك لـ: إنشاء حسابك وتأمينه؛ وإدارة التسجيلات ومشاركة ما يحتاجه المنظّمون لتأكيد مكانك؛ وتوفير مدربك الذكي وتخصيصه؛ وإرسال الإشعارات التي لم توقفها؛ ومراجعة المدفوعات اليدوية؛ وقياس الخدمة وتحسينها؛ والحفاظ على أمانها والامتثال للقانون.\nيقدّم المدرب الذكي إرشادات تدريبية فقط وليس نصيحة طبية. الجريات خاصة افتراضيًا ولا تظهر في لوحات الصدارة العامة إلا إذا اخترت مشاركتها. لا نبيع بياناتك الشخصية."
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
              "نستخدم عددًا محدودًا من ملفات تعريف الارتباط والتقنيات المشابهة. يمكنك مراجعة الملفات غير الأساسية وقبولها أو رفضها عبر الشريط الذي يظهر في زيارتك الأولى، ويمكنك تغيير الملفات أو حذفها في أي وقت من إعدادات متصفّحك.\n• أساسي (تسجيل الدخول): ملف جلسة آمن يضبطه نظام المصادقة لدينا يبقيك مسجّل الدخول. لا تعمل الخدمة بدونه، لذا لا يمكن إيقافه.\n• التفضيلات: «racedz-locale» يحفظ لغتك و«racedz-theme» يحفظ مظهرك (فاتح/داكن/سباق). يدوم كل منهما نحو سنة.\n• التحليلات الداخلية: «zr_vid» (نحو سنة) و«zr_sid» (نحو 30 دقيقة) معرّفان عشوائيان نقيس بهما الاستخدام الإجمالي، مثل عدد الزوار والصفحات الأكثر شعبية. هذه ملفاتنا الخاصة — ولا نستخدم ملفات إعلانية أو تتبّعية من أطراف ثالثة.\n• الموافقة: «zr_consent» يتذكّر اختيارك للملفات كي لا نسألك مجددًا.\nنخزّن أيضًا تفضيل مظهرك ومؤشّر مزامنة يُستخدم مرة واحدة في التخزين المحلي لمتصفّحك. إذا رفضت الملفات غير الأساسية، فلن نستخدم ملفات التحليلات. وإيقاف ملفات التفضيلات يعيد ببساطة ضبط لغتك ومظهرك المحفوظين."
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
        intro: "إجابات سريعة عن السباقات والحسابات والدفع والمدرب الذكي. هل ما زلت بحاجة إلى المساعدة؟ تواصل مع فريقنا من حسابك.",
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
            a: "تصفّح السباقات وإنشاء حساب والتسجيل فيها مجاني. يحدّد كل منظّم رسوم التسجيل في السباق. المدرب الذكي مجاني في الأسبوع الأول، ثم يتطلب اشتراكًا."
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
  }
} as const;

export function getContentDictionary(locale: Locale) {
  return contentDictionaries[locale];
}
