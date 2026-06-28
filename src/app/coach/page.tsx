import { ArrowRight, CalendarDays, MessageSquare, Route, Sparkles, Target } from "lucide-react";
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
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black text-gray-950 sm:text-3xl">{t.featuresTitle}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <feature.icon className="size-7 text-brand-orange" aria-hidden={true} />
              <h3 className="mt-4 text-lg font-black text-gray-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-600">
          <Sparkles className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
          {t.langNote}
        </p>
      </section>

      {/* How it works (a real ordered sequence) */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-gray-950 sm:text-3xl">{t.howTitle}</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="flex size-10 items-center justify-center rounded-full bg-teal-50 text-lg font-black text-brand-teal">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-black text-gray-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="relative grid gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0a3a36] p-8 text-white shadow-soft md:grid-cols-[1fr_auto] md:items-center">
          <PanelBrandMark className="-end-10 -top-10 w-56 sm:w-64" />
          <div className="relative">
            <h2 className="text-2xl font-black sm:text-3xl">{t.ctaTitle}</h2>
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
