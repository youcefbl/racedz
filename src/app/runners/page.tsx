import { ArrowRight, Bell, CalendarSearch, ClipboardList, MapPin, Smartphone, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { RaceDZMark } from "@/components/layout/racedz-logo";
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
    { title: content.coachTitle, text: content.coachText, icon: Sparkles },
    { title: content.remindersTitle, text: content.remindersText, icon: Bell }
  ];

  const appFeatures = [content.appFeature1, content.appFeature2, content.appFeature3];

  return (
    <div className="bg-gray-50" dir={rtl ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-teal via-[#0c5650] to-[#0a3a36] text-white">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g className="rz-chevrons-drift">
            <path d="M40 50 L95 105 L40 160" stroke="#ffffff" opacity="0.08" />
            <path d="M100 50 L155 105 L100 160" stroke="#ffffff" opacity="0.12" />
            <path d="M160 50 L215 105 L160 160" stroke="#F97316" opacity="0.5" />
          </g>
        </svg>
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="rz-fade-up inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
              <RaceDZMark className="size-5" animated />
              {content.eyebrow}
            </p>
            <h1 className="rz-fade-up-2 mt-4 text-4xl font-black leading-tight sm:text-5xl">{content.title}</h1>
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
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-brand-teal">RaceDZ</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950 sm:text-3xl">{content.workflowTitle}</h2>
          </div>
          <ButtonLink href={withLocale("/account/registrations", locale)} variant="outline" size="sm">
            {content.dashboardCta}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </ButtonLink>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex size-11 items-center justify-center rounded-lg bg-orange-50 text-brand-orange">
                <feature.icon className="size-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-black text-gray-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mobile app showcase */}
      <section className="border-t border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-brand-teal">
              <Smartphone className="size-4" aria-hidden="true" />
              {content.appEyebrow}
            </p>
            <h2 className="mt-4 text-2xl font-black text-gray-950 sm:text-3xl">{content.appTitle}</h2>
            <p className="mt-3 text-base leading-7 text-gray-600">{content.appText}</p>
            <ul className="mt-6 grid gap-3">
              {appFeatures.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-semibold text-gray-800">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
                    <MapPin className="size-3.5" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-sm font-black text-white">
              <Smartphone className="size-4 text-brand-orange" aria-hidden="true" />
              {content.appBadge}
            </p>
          </div>

          {/* Phone mock */}
          <div className="mx-auto w-56 shrink-0">
            <div className="rounded-[2rem] border-[6px] border-gray-950 bg-gray-950 p-2 shadow-soft">
              <div className="overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-brand-teal to-[#0a3a36] p-5 text-white">
                <div className="flex items-center justify-between text-[10px] font-bold opacity-80">
                  <span>RaceDZ</span>
                  <span>9:41</span>
                </div>
                <RaceDZMark className="mx-auto mt-6 size-14" animated />
                <p className="mt-4 text-center text-xs font-bold uppercase tracking-wide opacity-80">{content.appEyebrow}</p>
                <div className="mt-5 space-y-2">
                  <div className="rounded-lg bg-white/10 px-3 py-2">
                    <p className="text-[10px] uppercase opacity-70">Distance</p>
                    <p className="text-lg font-black">7.42 km</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <p className="text-[10px] uppercase opacity-70">Pace</p>
                      <p className="text-sm font-black">5:18/km</p>
                    </div>
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <p className="text-[10px] uppercase opacity-70">Time</p>
                      <p className="text-sm font-black">39:21</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
