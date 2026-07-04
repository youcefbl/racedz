import {
  ArrowRight,
  CalendarDays,
  Gauge,
  HeartPulse,
  Languages,
  Lightbulb,
  MessageSquare,
  Route,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/button";
import { ZidRunMark } from "@/components/layout/racedz-logo";
import { PanelBrandMark } from "@/components/layout/panel-brand-mark";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";

type CoachLandingPageProps = {
  searchParams?: Promise<{
    lang?: Locale;
  }>;
};

// Public marketing/landing page for the AI Coach (NOT the in-app coach, which
// lives at /account/coach). Explains the feature and offers the free month.
export default async function CoachLandingPage({ searchParams }: CoachLandingPageProps) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = getDictionary(locale).pages.coachLanding;

  // Visitors start the free month at sign-up; signed-in members go straight to
  // their coach. Promo only — no billing/trial logic here.
  const session = await auth();
  const isMember = Boolean(session?.user);
  const primaryHref = withLocale(isMember ? "/account/coach" : "/register", locale);
  const primaryLabel = isMember ? t.primaryCtaMember : t.primaryCta;

  const features = [
    { title: t.planTitle, text: t.planText, icon: CalendarDays },
    { title: t.runsTitle, text: t.runsText, icon: Route },
    { title: t.reviewsTitle, text: t.reviewsText, icon: MessageSquare },
    { title: t.goalsTitle, text: t.goalsText, icon: Target }
  ];

  // What the plan is personalized to — the runner, not a template.
  const factors = [
    { title: t.factorLevelTitle, text: t.factorLevelText, icon: Gauge },
    { title: t.factorBodyTitle, text: t.factorBodyText, icon: HeartPulse },
    { title: t.factorInjuryTitle, text: t.factorInjuryText, icon: ShieldCheck },
    { title: t.factorScheduleTitle, text: t.factorScheduleText, icon: CalendarDays }
  ];

  const steps = [
    { title: t.step1Title, text: t.step1Text },
    { title: t.step2Title, text: t.step2Text },
    { title: t.step3Title, text: t.step3Text }
  ];

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-teal via-[#0c5650] to-[#0a3a36] text-white">
        <PanelBrandMark className="-end-16 -top-24 w-[30rem] sm:w-[40rem]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="rz-fade-up inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
              <ZidRunMark className="size-5" animated />
              {t.eyebrow}
            </p>
            <h1 className="rz-fade-up-2 mt-4 text-balance text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              {t.title}
            </h1>
            <p className="rz-fade-up-3 mt-5 max-w-2xl text-lg leading-8 text-teal-50">{t.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href={primaryHref} variant="primary" size="lg">
                {primaryLabel}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden={true} />
              </ButtonLink>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold backdrop-blur">
                <Sparkles className="size-4 text-brand-orange" aria-hidden="true" />
                {t.trialBadge}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-teal-100">{t.trialNote}</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <h2 className="text-balance text-2xl font-black text-gray-950 sm:text-3xl">{t.featuresTitle}</h2>
        <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-start gap-4 p-5 sm:gap-5 sm:p-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
                <feature.icon className="size-6" aria-hidden={true} />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-gray-950">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Personalization — a plan built around the runner */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-balance text-2xl font-black text-gray-950 sm:text-3xl">{t.personalizeTitle}</h2>
            <p className="mt-3 text-base leading-7 text-gray-600">{t.personalizeText}</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {factors.map((factor) => (
              <div key={factor.title} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex size-11 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                  <factor.icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-black text-gray-950">{factor.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{factor.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works → guided all the way to the goal */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <h2 className="text-balance text-2xl font-black text-gray-950 sm:text-3xl">{t.howTitle}</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-full bg-teal-50 text-lg font-black text-brand-teal">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-black text-gray-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-start gap-2.5 rounded-xl bg-orange-50 p-4 text-sm font-bold text-gray-800">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden="true" />
          {t.guidanceNote}
        </p>
      </section>

      {/* Tips + languages — two things that keep runners coming back */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-2 lg:py-16 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-7">
            <div className="flex size-11 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
              <Lightbulb className="size-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-black text-gray-950">{t.tipsTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{t.tipsText}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-7">
            <div className="flex size-11 items-center justify-center rounded-xl bg-teal-50 text-brand-teal">
              <Languages className="size-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-xl font-black text-gray-950">{t.langTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{t.langText}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["العربية", "Français", "English"].map((label) => (
                <span key={label} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-700">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <div className="relative grid gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0a3a36] p-8 text-white shadow-soft md:grid-cols-[1fr_auto] md:items-center">
          <PanelBrandMark className="-end-10 -top-10 w-56 sm:w-64" />
          <div className="relative">
            <h2 className="text-balance text-2xl font-black sm:text-3xl">{t.ctaTitle}</h2>
            <p className="mt-2 max-w-xl text-teal-50">{t.ctaText}</p>
          </div>
          <ButtonLink href={primaryHref} variant="primary" size="lg" className="relative">
            {primaryLabel}
            <ArrowRight className="size-5 rtl:rotate-180" aria-hidden={true} />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
