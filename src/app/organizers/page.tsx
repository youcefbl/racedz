import { ArrowRight, BellRing, ClipboardList, Route, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ZidRunMark } from "@/components/layout/racedz-logo";
import { PanelBrandMark } from "@/components/layout/panel-brand-mark";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";

type OrganizersPageProps = {
  searchParams?: Promise<{
    lang?: Locale;
  }>;
};

export default async function OrganizersPage({ searchParams }: OrganizersPageProps) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const dictionary = getDictionary(locale);
  const content = dictionary.pages.organizers;
  const features = [
    {
      title: content.publishTitle,
      text: content.publishText,
      icon: Route
    },
    {
      title: content.registrationsTitle,
      text: content.registrationsText,
      icon: ClipboardList
    },
    {
      title: content.teamTitle,
      text: content.teamText,
      icon: UsersRound
    },
    {
      title: content.updatesTitle,
      text: content.updatesText,
      icon: BellRing
    }
  ];

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-teal via-[#0c5650] to-[#0a3a36] text-white">
        <PanelBrandMark className="-end-16 -top-24 w-[30rem] sm:w-[40rem]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="rz-fade-up inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand-orange">
              <ZidRunMark className="size-5" animated />
              {content.eyebrow}
            </p>
            <h1 className="rz-fade-up-2 mt-4 text-balance text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">{content.title}</h1>
            <p className="rz-fade-up-3 mt-5 max-w-2xl text-lg leading-8 text-teal-50">{content.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={withLocale("/organizer/request", locale)} variant="primary" size="lg">
                {content.primaryCta}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden={true} />
              </ButtonLink>
              <ButtonLink href={withLocale("/races", locale)} variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:border-white hover:text-white">
                {content.secondaryCta}
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm font-semibold text-teal-100">{content.reviewNote}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-950">{content.workflowTitle}</h2>
          </div>
          <ButtonLink href={withLocale("/organizer", locale)} variant="outline" size="sm">
            {content.dashboardCta}
          </ButtonLink>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <feature.icon className="size-7 text-brand-orange" aria-hidden={true} />
              <h3 className="mt-4 text-lg font-black text-gray-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
