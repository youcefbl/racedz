import { ArrowRight, BarChart3, CalendarSearch, Check, CreditCard, Languages, MapPin, Sparkles, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/button";
import { ZidRunMark } from "@/components/layout/racedz-logo";
import { PanelBrandMark } from "@/components/layout/panel-brand-mark";
import { PricingPlans, type PricingPlansCopy } from "@/components/pricing/pricing-plans";
import { COACH_CURRENCY, COACH_PLANS, STUDENT_PROMO } from "@/lib/coach/plans";
import { getLocale, withLocale, type Locale } from "@/lib/i18n";

export const metadata = {
  title: "Pricing — ZidRun",
  description: "Race calendar and run tracking are free forever. The AI coach is free for 7 days, then 790 DA/month or 4,900 DA/year."
};

// Prices come from the shared plan config (same source the admin activation uses), so the number
// a runner sees here is the number that gets billed. Only the surrounding words are translated.
const MONTHLY = COACH_PLANS.MONTHLY.priceDa;
const YEARLY = COACH_PLANS.YEARLY.priceDa;
const CURRENCY = COACH_CURRENCY;
const STUDENT_CODE = STUDENT_PROMO.code;
const LOCALE_TAG: Record<Locale, string> = { en: "en", fr: "fr", ar: "ar" };

type PricingCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  freeTitle: string;
  freeSubtitle: string;
  freeFeatures: { title: string; text: string }[];
  freeCta: string;
  coachSectionTitle: string;
  coachSectionText: string;
  payTitle: string;
  payText: string;
  closingTitle: string;
  closingText: string;
  closingCta: string;
  plans: PricingPlansCopy;
};

export default async function PricingPage({ searchParams }: { searchParams?: Promise<{ lang?: Locale }> }) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = COPY[locale];
  const session = await auth();
  const isMember = Boolean(session?.user);

  const startHref = withLocale(isMember ? "/account/coach" : "/register", locale);
  const freeHref = withLocale(isMember ? "/races" : "/register", locale);
  const freeIcons = [CalendarSearch, MapPin, BarChart3, Trophy, Languages];

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-teal via-[#0c5650] to-[#0a3a36] text-white">
        <PanelBrandMark className="-end-16 -top-24 w-[30rem] sm:w-[40rem]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
              <ZidRunMark className="size-5" animated />
              {t.eyebrow}
            </p>
            <h1 className="mt-4 text-balance text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{t.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-teal-50">{t.intro}</p>
          </div>
        </div>
      </section>

      {/* Free forever */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2.5 text-balance text-2xl font-black text-gray-950 sm:text-3xl">
              <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-sm font-black text-brand-teal">0 {CURRENCY}</span>
              {t.freeTitle}
            </h2>
            <p className="mt-2 max-w-xl text-base leading-7 text-gray-600">{t.freeSubtitle}</p>
          </div>
          <ButtonLink href={freeHref} variant="outline" size="md" className="shrink-0">
            {t.freeCta}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </ButtonLink>
        </div>

        <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {t.freeFeatures.map((feature, index) => {
            const Icon = freeIcons[index] ?? Check;
            return (
              <div key={feature.title} className="flex items-start gap-4 p-5 sm:gap-5 sm:p-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-teal">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-black text-gray-950">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-gray-600">{feature.text}</p>
                </div>
                <Check className="mt-1 size-5 shrink-0 text-brand-teal" aria-hidden="true" />
              </div>
            );
          })}
        </div>
      </section>

      {/* Coach plans */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="flex items-center justify-center gap-2.5 text-balance text-2xl font-black text-gray-950 sm:text-3xl">
              <Sparkles className="size-6 shrink-0 text-brand-orange" aria-hidden="true" />
              {t.coachSectionTitle}
            </h2>
            <p className="mt-3 text-base leading-7 text-gray-600">{t.coachSectionText}</p>
          </div>
          <div className="mt-10">
            <PricingPlans
              monthly={MONTHLY}
              yearly={YEARLY}
              currency={CURRENCY}
              studentCode={STUDENT_CODE}
              ctaHref={startHref}
              copy={t.plans}
              localeTag={LOCALE_TAG[locale]}
            />
          </div>
        </div>
      </section>

      {/* Payment methods — trust */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
            <CreditCard className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-gray-950">{t.payTitle}</h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">{t.payText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["CIB", "Edahabia", "CCP", "BaridiMob"].map((method) => (
              <span key={method} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-black text-gray-700">
                {method}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="relative grid gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0a3a36] p-8 text-white shadow-soft md:grid-cols-[1fr_auto] md:items-center">
          <PanelBrandMark className="-end-10 -top-10 w-56 sm:w-64" />
          <div className="relative">
            <h2 className="text-balance text-2xl font-black sm:text-3xl">{t.closingTitle}</h2>
            <p className="mt-2 max-w-xl text-teal-50">{t.closingText}</p>
          </div>
          <ButtonLink href={startHref} variant="primary" size="lg" className="relative">
            {t.closingCta}
            <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}

const COPY: Record<Locale, PricingCopy> = {
  en: {
    eyebrow: "Pricing",
    title: "Start free. Add your coach when you're ready.",
    intro: "Finding races and tracking your runs is free — forever. The AI coach is free for 7 days, then less than a coffee a week.",
    freeTitle: "Free, forever",
    freeSubtitle: "No card, no trial clock. The whole platform is on the house.",
    freeFeatures: [
      { title: "Race calendar", text: "Discover and register for every race in Algeria — filter by wilaya, distance, and date." },
      { title: "Live run tracking", text: "GPS tracking with live average & current pace and per-kilometre splits." },
      { title: "Run history & stats", text: "Every run saved with splits, elevation, calories, and your own photos." },
      { title: "Rankings", text: "See where you stand among runners across the country." },
      { title: "Three languages", text: "Arabic, French, and English — fully right-to-left for Arabic." }
    ],
    freeCta: "Create free account",
    coachSectionTitle: "Then, when you want a coach",
    coachSectionText: "Everything above stays free. The coach adds a personalised plan and real feedback after every run — free for 7 days, cancel anytime.",
    payTitle: "Pay the local way",
    payText: "CIB or Edahabia card, CCP, or BaridiMob — whatever's easiest for you.",
    closingTitle: "Ready to run with a coach?",
    closingText: "Create your free account and start your 7-day coach trial today.",
    closingCta: "Start free — 7-day coach trial",
    plans: {
      monthly: "Monthly",
      yearly: "Yearly",
      perMonth: "/mo",
      perYear: "/yr",
      perMonthApprox: "≈ {price} {currency}/mo",
      save: "Save {percent}%",
      bestValue: "Best value",
      coachTitle: "ZidRun Coach",
      coachSubtitle: "Your AI running coach",
      trialBadge: "7 days free",
      afterTrial: "then {price} · cancel anytime",
      cta: "Start 7-day free trial",
      features: [
        "Personalised weekly plan that adapts as you run",
        "AI feedback after every run",
        "Ask your coach anything, anytime",
        "Tips matched to your level & goal",
        "Guided all the way to your goal",
        "In Arabic, French & English"
      ],
      studentTitle: "Students save 20%",
      studentText: "Use code {code} — for students in Algeria."
    }
  },
  fr: {
    eyebrow: "Tarifs",
    title: "Commence gratuitement. Ajoute ton coach quand tu veux.",
    intro: "Trouver des courses et suivre tes sorties, c'est gratuit — pour toujours. Le coach IA est gratuit 7 jours, puis moins qu'un café par semaine.",
    freeTitle: "Gratuit, pour toujours",
    freeSubtitle: "Sans carte, sans compte à rebours. Toute la plateforme, offerte.",
    freeFeatures: [
      { title: "Calendrier des courses", text: "Découvre et inscris-toi à toutes les courses d'Algérie — filtre par wilaya, distance et date." },
      { title: "Suivi de course en direct", text: "Suivi GPS avec allure moyenne et instantanée en direct, et splits au kilomètre." },
      { title: "Historique & statistiques", text: "Chaque sortie enregistrée avec splits, dénivelé, calories et tes photos." },
      { title: "Classements", text: "Vois où tu te situes parmi les coureurs du pays." },
      { title: "Trois langues", text: "Arabe, français et anglais — entièrement de droite à gauche pour l'arabe." }
    ],
    freeCta: "Créer un compte gratuit",
    coachSectionTitle: "Puis, quand tu veux un coach",
    coachSectionText: "Tout ce qui précède reste gratuit. Le coach ajoute un plan personnalisé et un vrai retour après chaque sortie — gratuit 7 jours, annulable à tout moment.",
    payTitle: "Paye à la locale",
    payText: "Carte CIB ou Edahabia, CCP ou BaridiMob — ce qui t'arrange le plus.",
    closingTitle: "Prêt à courir avec un coach ?",
    closingText: "Crée ton compte gratuit et démarre ton essai coach de 7 jours dès aujourd'hui.",
    closingCta: "Commencer — essai coach 7 jours",
    plans: {
      monthly: "Mensuel",
      yearly: "Annuel",
      perMonth: "/mois",
      perYear: "/an",
      perMonthApprox: "≈ {price} {currency}/mois",
      save: "−{percent}%",
      bestValue: "Meilleur prix",
      coachTitle: "ZidRun Coach",
      coachSubtitle: "Ton coach de course IA",
      trialBadge: "7 jours gratuits",
      afterTrial: "puis {price} · annulable à tout moment",
      cta: "Commencer l'essai gratuit",
      features: [
        "Plan hebdo personnalisé qui s'adapte à toi",
        "Retour IA après chaque sortie",
        "Pose n'importe quelle question au coach",
        "Conseils adaptés à ton niveau et objectif",
        "Accompagné jusqu'à ton objectif",
        "En arabe, français et anglais"
      ],
      studentTitle: "−20 % étudiants",
      studentText: "Utilise le code {code} — pour les étudiants en Algérie."
    }
  },
  ar: {
    eyebrow: "الأسعار",
    title: "ابدأ مجانًا. أضِف مدربك عندما تكون جاهزًا.",
    intro: "البحث عن السباقات وتتبّع جريك مجاني — للأبد. المدرب الذكي مجاني لمدة 7 أيام، ثم بأقل من ثمن قهوة في الأسبوع.",
    freeTitle: "مجاني، للأبد",
    freeSubtitle: "بدون بطاقة، بدون عدّاد تجربة. المنصّة كاملة على حسابنا.",
    freeFeatures: [
      { title: "رزنامة السباقات", text: "اكتشف وسجّل في كل سباقات الجزائر — صفِّ حسب الولاية والمسافة والتاريخ." },
      { title: "تتبّع الجري المباشر", text: "تتبّع GPS مع الوتيرة المتوسطة والحالية مباشرة، ومقاطع لكل كيلومتر." },
      { title: "السجل والإحصائيات", text: "كل حصة محفوظة مع المقاطع والارتفاع والسعرات وصورك." },
      { title: "الترتيب", text: "شاهد موقعك بين العدّائين عبر البلاد." },
      { title: "ثلاث لغات", text: "العربية والفرنسية والإنجليزية — بدعم كامل للكتابة من اليمين لليسار." }
    ],
    freeCta: "إنشاء حساب مجاني",
    coachSectionTitle: "ثم، عندما تريد مدربًا",
    coachSectionText: "كل ما سبق يبقى مجانيًا. يضيف المدرب برنامجًا مخصصًا وملاحظات حقيقية بعد كل حصة — مجانًا 7 أيام، إلغاء في أي وقت.",
    payTitle: "ادفع بطريقتك المحلية",
    payText: "بطاقة CIB أو الذهبية، CCP، أو بريدي موب — كما يناسبك.",
    closingTitle: "جاهز للجري مع مدرب؟",
    closingText: "أنشئ حسابك المجاني وابدأ تجربة المدرب لمدة 7 أيام اليوم.",
    closingCta: "ابدأ مجانًا — تجربة مدرب 7 أيام",
    plans: {
      monthly: "شهري",
      yearly: "سنوي",
      perMonth: "/شهر",
      perYear: "/سنة",
      perMonthApprox: "≈ {price} {currency}/شهر",
      save: "−{percent}%",
      bestValue: "أفضل قيمة",
      coachTitle: "ZidRun Coach",
      coachSubtitle: "مدربك للجري بالذكاء الاصطناعي",
      trialBadge: "7 أيام مجانًا",
      afterTrial: "ثم {price} · إلغاء في أي وقت",
      cta: "ابدأ التجربة المجانية",
      features: [
        "برنامج أسبوعي مخصص يتكيّف مع جريك",
        "ملاحظات ذكية بعد كل حصة",
        "اسأل مدربك أي شيء، في أي وقت",
        "نصائح تناسب مستواك وهدفك",
        "مرافقة حتى تحقيق هدفك",
        "بالعربية والفرنسية والإنجليزية"
      ],
      studentTitle: "خصم 20% للطلبة",
      studentText: "استخدم الرمز {code} — للطلبة في الجزائر."
    }
  }
};
