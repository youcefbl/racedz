import { ArrowRight, Bell, CalendarSearch, Check, ClipboardList, Route, Smartphone, Sparkles, SunMoon, Trophy } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ZidRunMark } from "@/components/layout/racedz-logo";
import { PanelBrandMark } from "@/components/layout/panel-brand-mark";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";

type RunnersPageProps = {
  searchParams?: Promise<{ lang?: Locale }>;
};

export default async function RunnersPage({ searchParams }: RunnersPageProps) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const dictionary = getDictionary(locale);
  const content = dictionary.pages.runners;
  const rtl = locale === "ar";

  const features = [
    { title: content.discoverTitle, text: content.discoverText, icon: CalendarSearch },
    { title: content.registerTitle, text: content.registerText, icon: ClipboardList },
    { title: content.trackTitle, text: content.trackText, icon: Route },
    { title: content.coachTitle, text: content.coachText, icon: Sparkles },
    { title: content.rankTitle, text: content.rankText, icon: Trophy },
    { title: content.remindersTitle, text: content.remindersText, icon: Bell }
  ];

  const appFeatures = [content.appFeature1, content.appFeature2, content.appFeature3];

  return (
    <div className="bg-gray-50" dir={rtl ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-teal via-[#0c5650] to-[#0a3a36] text-white">
        <PanelBrandMark className="-end-16 -top-24 w-[30rem] sm:w-[40rem]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="rz-fade-up inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
              <ZidRunMark className="size-5" animated />
              {content.eyebrow}
            </p>
            <h1 className="rz-fade-up-2 mt-4 text-balance text-4xl font-black leading-tight sm:text-5xl">{content.title}</h1>
            <p className="rz-fade-up-3 mt-5 max-w-2xl text-lg leading-8 text-teal-50">{content.intro}</p>
            <div className="rz-fade-up-3 mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={withLocale("/races", locale)} variant="primary" size="lg">
                {content.primaryCta}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink
                href={withLocale("/register", locale)}
                variant="outline"
                size="lg"
                className="border-white/30 bg-white/10 text-white hover:border-white hover:text-white"
              >
                {content.secondaryCta}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-2xl text-balance text-2xl font-black text-gray-950 sm:text-3xl">{content.workflowTitle}</h2>
          <ButtonLink href={withLocale("/account/registrations", locale)} variant="outline" size="sm">
            {content.dashboardCta}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </ButtonLink>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-teal/40 hover:shadow-md"
            >
              <div className="flex size-11 items-center justify-center rounded-lg bg-orange-50 text-brand-orange transition group-hover:scale-105">
                <feature.icon className="size-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-black text-gray-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mobile app showcase — real device shot that follows the selected theme.
          Redundant inside the native app (you're already in it), so it's hidden there. */}
      <section className="rz-hide-native relative overflow-hidden border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_auto] lg:gap-16 lg:px-8">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-brand-teal">
              <Smartphone className="size-4" aria-hidden="true" />
              {content.appEyebrow}
            </p>
            <h2 className="mt-4 text-balance text-3xl font-black leading-tight text-gray-950 sm:text-4xl">{content.appTitle}</h2>
            <p className="mt-3 text-base leading-7 text-gray-600">{content.appText}</p>
            <ul className="mt-7 grid gap-3.5">
              {appFeatures.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-semibold text-gray-800">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-start gap-2 text-sm font-semibold text-gray-600">
              <SunMoon className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden="true" />
              {content.appThemesNote}
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-sm font-black text-white">
              <Smartphone className="size-4 text-brand-orange" aria-hidden="true" />
              {content.appBadge}
            </p>
          </div>

          {/* Device frame: two captures stacked, one shown per theme (see globals.css). */}
          <div className="relative mx-auto">
            <div
              className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-teal/25 via-transparent to-brand-orange/25 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative w-[244px] rounded-[2.6rem] border-[10px] border-gray-950 bg-gray-950 shadow-soft sm:w-[260px]">
              {/* Fixed aspect crops the screenshot to its hero, keeping the device
                  proportional to the copy beside it. CSS background images (not image
                  elements) so the hidden theme's file is never downloaded. */}
              <div className="relative overflow-hidden rounded-[1.9rem] bg-gray-950" style={{ aspectRatio: "9 / 16" }}>
                <div
                  role="img"
                  aria-label={content.appShotAltLight}
                  className="rz-appshot-light absolute inset-0 bg-cover bg-top"
                  style={{ backgroundImage: "url('/app/app-home-light.webp')" }}
                />
                <div
                  role="img"
                  aria-label={content.appShotAltDark}
                  className="rz-appshot-dark absolute inset-0 bg-cover bg-top"
                  style={{ backgroundImage: "url('/app/app-home-dark.webp')" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
