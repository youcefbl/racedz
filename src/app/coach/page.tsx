import {
  Activity,
  BarChart3,
  BrainCircuit,
  ArrowRight,
  CalendarDays,
  CloudSun,
  Gauge,
  HeartPulse,
  Languages,
  Lightbulb,
  Mic2,
  MessageSquare,
  Moon,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Utensils
} from "lucide-react";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "AI Running Coach | ZidRun",
  description:
    "Set a goal, log your runs, and get adaptive coaching, post-run feedback, and recovery guidance in Arabic, French, or English."
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

  const featureGroups = [
    {
      title: t.trainGroupTitle,
      intro: t.trainGroupText,
      items: [
        { title: t.planTitle, text: t.planText, icon: CalendarDays },
        { title: t.goalsTitle, text: t.goalsText, icon: Target },
        { title: t.runsTitle, text: t.runsText, icon: Route },
        { title: t.guidedTitle, text: t.guidedText, icon: Mic2 }
      ]
    },
    {
      title: t.learnGroupTitle,
      intro: t.learnGroupText,
      items: [
        { title: t.reviewsTitle, text: t.reviewsText, icon: BarChart3 },
        { title: t.chatTitle, text: t.chatText, icon: MessageSquare },
        { title: t.recoveryTitle, text: t.recoveryText, icon: Moon },
        { title: t.nutritionTitle, text: t.nutritionText, icon: Utensils }
      ]
    },
    {
      title: t.stayOnTrackGroupTitle,
      intro: t.stayOnTrackGroupText,
      items: [
        { title: t.weatherTitle, text: t.weatherText, icon: CloudSun },
        { title: t.tipsFeatureTitle, text: t.tipsFeatureText, icon: Lightbulb },
        { title: t.memoryTitle, text: t.memoryText, icon: BrainCircuit },
        { title: t.safetyFeatureTitle, text: t.safetyFeatureText, icon: ShieldCheck }
      ]
    }
  ];

  const examples = [
    { label: t.exampleGoalLabel, title: t.exampleGoalTitle, prompt: t.exampleGoalPrompt, response: t.exampleGoalResponse, icon: Target },
    { label: t.exampleRunLabel, title: t.exampleRunTitle, prompt: t.exampleRunPrompt, response: t.exampleRunResponse, icon: Activity },
    { label: t.exampleLifeLabel, title: t.exampleLifeTitle, prompt: t.exampleLifePrompt, response: t.exampleLifeResponse, icon: HeartPulse }
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
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="rz-fade-up inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
              <ZidRunMark className="size-5" animated />
              {t.eyebrow}
            </p>
            <h1 className="rz-fade-up-2 mt-4 text-balance text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              {t.title}
            </h1>
            <p className="rz-fade-up-3 mt-5 max-w-2xl text-lg leading-8 text-teal-50">{t.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={primaryHref} variant="primary" size="lg">
                  {primaryLabel}
                  <ArrowRight className="size-5 rtl:rotate-180" aria-hidden={true} />
                </ButtonLink>
                <ButtonLink
                  href={withLocale("/races", locale)}
                  variant="outline"
                  size="lg"
                  className="border-white/40 bg-white/10 text-white hover:bg-white hover:text-gray-950"
                >
                  {t.secondaryCta}
                </ButtonLink>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold backdrop-blur">
                <Sparkles className="size-4 text-brand-orange" aria-hidden="true" />
                {t.trialBadge}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-teal-100">{t.trialNote}</p>
          </div>
          <div className="relative rounded-2xl border border-white/15 bg-gray-950/40 p-5 shadow-2xl backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-orange">{t.previewEyebrow}</p>
                <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{t.previewTitle}</h2>
              </div>
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
                <Sparkles className="size-5" aria-hidden={true} />
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-teal-50">{t.previewText}</p>
            <div className="mt-5 rounded-xl border border-white/10 bg-white/10 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-teal-100">{t.previewWorkoutLabel}</p>
                  <p className="mt-1 text-lg font-black text-white">{t.previewWorkoutTitle}</p>
                </div>
                <span className="rounded-full bg-brand-orange px-2.5 py-1 text-xs font-black text-[#18001c]">{t.previewWorkoutBadge}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[t.previewMetricOne, t.previewMetricTwo, t.previewMetricThree].map((metric) => (
                  <span key={metric} className="rounded-lg bg-black/20 px-2 py-2 text-xs font-bold text-teal-50">{metric}</span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm text-gray-900">
              <MessageSquare className="mt-0.5 size-5 shrink-0 text-brand-teal" aria-hidden={true} />
              <p className="leading-6"><span className="font-black">{t.previewCoachLabel}</span> {t.previewCoachText}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-balance text-2xl font-black text-gray-950 sm:text-3xl">{t.featuresTitle}</h2>
          <p className="mt-3 text-base leading-7 text-gray-600">{t.featuresIntro}</p>
        </div>
        <div className="mt-8 space-y-4">
          {featureGroups.map((group) => (
            <section key={group.title} className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-[.72fr_1.28fr] lg:p-8">
              <div>
                <h3 className="text-xl font-black text-gray-950">{group.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-gray-600">{group.intro}</p>
              </div>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50">
                {group.items.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-4 p-4 sm:p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
                      <feature.icon className="size-5" aria-hidden={true} />
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-black text-gray-950">{feature.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{feature.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
          {/* One panel of divided "signals" rather than four separate cards — reads as
              inputs the coach reads about you, and breaks the icon-card grid rhythm. */}
          <div className="mt-8 grid gap-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-gray-200 rtl:lg:divide-x-reverse">
            {factors.map((factor) => (
              <div key={factor.title} className="lg:px-6 lg:first:ps-0 lg:last:pe-0">
                <factor.icon className="size-6 text-brand-teal" aria-hidden="true" />
                <h3 className="mt-3 text-base font-black text-gray-950">{factor.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">{factor.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Examples — show the value in the runner's own words. */}
      <section id="examples" className="border-y border-gray-200 bg-gray-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-wide text-brand-orange">{t.examplesEyebrow}</p>
            <h2 className="mt-2 text-balance text-2xl font-black sm:text-3xl">{t.examplesTitle}</h2>
            <p className="mt-3 text-base leading-7 text-gray-300">{t.examplesIntro}</p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {examples.map((example) => (
              <article key={example.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                <div className="flex items-center gap-3 text-brand-orange">
                  <example.icon className="size-5" aria-hidden={true} />
                  <span className="text-xs font-black uppercase tracking-wide">{example.label}</span>
                </div>
                <h3 className="mt-5 text-lg font-black text-white">{example.title}</h3>
                <p className="mt-4 rounded-xl bg-white/10 p-4 text-sm leading-6 text-gray-200">“{example.prompt}”</p>
                <p className="mt-4 text-sm leading-6 text-teal-100"><span className="font-black text-white">{t.exampleCoachLabel}</span> {example.response}</p>
              </article>
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
      </section>

      {/* Guidance-to-goal — a bold full-width band that breaks the card rhythm. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0a3a36] p-6 text-white shadow-soft sm:p-8">
          <PanelBrandMark className="-end-8 -top-10 w-44 sm:w-56" />
          <p className="relative flex items-start gap-3 text-lg font-black leading-8 sm:text-xl sm:leading-9">
            <Sparkles className="mt-1 size-6 shrink-0 text-brand-orange" aria-hidden="true" />
            {t.guidanceNote}
          </p>
        </div>
      </section>

      {/* Tips + languages — asymmetric, with inline icons instead of icon squares so
          it reads differently from the feature list above. */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr] lg:py-16 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
            <h3 className="flex items-center gap-2.5 text-xl font-black text-gray-950">
              <Lightbulb className="size-6 shrink-0 text-brand-orange" aria-hidden="true" />
              {t.tipsTitle}
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base sm:leading-7">{t.tipsText}</p>
          </div>
          <div className="rounded-2xl border border-brand-teal/30 bg-teal-50 p-6 sm:p-8">
            <h3 className="flex items-center gap-2.5 text-xl font-black text-gray-950">
              <Languages className="size-6 shrink-0 text-brand-teal" aria-hidden="true" />
              {t.langTitle}
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-700">{t.langText}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["العربية", "Français", "English"].map((label) => (
                <span key={label} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-700">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Safety and privacy — the coach is easier to trust when its limits are explicit. */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <div className="grid gap-8 rounded-2xl border border-teal-200 bg-teal-50 p-6 sm:p-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <div className="flex size-11 items-center justify-center rounded-xl bg-white text-brand-teal shadow-sm">
              <ShieldCheck className="size-6" aria-hidden={true} />
            </div>
            <h2 className="mt-4 text-balance text-2xl font-black text-gray-950 sm:text-3xl">{t.trustTitle}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-gray-700">{t.trustText}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: t.privacyTitle, text: t.privacyText },
              { title: t.safetyTitle, text: t.safetyText },
              { title: t.controlTitle, text: t.controlText }
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-teal-200/70 bg-white/75 p-4">
                <h3 className="font-black text-gray-950">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-gray-500">{t.disclaimer}</p>
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
