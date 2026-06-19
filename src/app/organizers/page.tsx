import { ArrowRight, BellRing, ClipboardList, Route, UsersRound } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
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
      <section className="relative isolate overflow-hidden bg-gray-950 text-white">
        <Image
          src="/racedz-logo.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/70" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-normal text-brand-orange">{content.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{content.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-200">{content.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={withLocale("/organizer/request", locale)} variant="primary" size="lg">
                {content.primaryCta}
                <ArrowRight className="size-5" aria-hidden={true} />
              </ButtonLink>
              <ButtonLink href={withLocale("/races", locale)} variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:border-white hover:text-white">
                {content.secondaryCta}
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-300">{content.reviewNote}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-brand-teal">RaceDZ</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">{content.workflowTitle}</h2>
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
