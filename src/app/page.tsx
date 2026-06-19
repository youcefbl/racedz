import { ArrowRight, CalendarDays, MapPin, Route, Trophy, UsersRound } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { RaceCard } from "@/components/races/race-card";
import { RaceSearchForm } from "@/components/races/race-search-form";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";
import { getUpcomingRaceEvents } from "@/lib/race-repository";

type HomePageProps = {
  searchParams?: Promise<{
    lang?: Locale;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const dictionary = getDictionary(locale);
  const upcomingRaces = await getUpcomingRaceEvents(3);
  const raceTypes = [
    { label: dictionary.home.roadRaces, icon: Route },
    { label: dictionary.home.trailRaces, icon: MapPin },
    { label: dictionary.home.marathons, icon: Trophy },
    { label: dictionary.home.kidsRaces, icon: UsersRound }
  ];

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:items-center lg:px-8 lg:py-14">
          <div className="space-y-7">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{dictionary.home.eyebrow}</p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight text-gray-950 sm:text-5xl">
                {dictionary.home.title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-gray-600">
                {dictionary.home.subtitle}
              </p>
            </div>
            <RaceSearchForm lang={locale} labels={dictionary.search} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={withLocale("/races", locale)} variant="secondary" size="lg">
                {dictionary.home.findRace}
                <ArrowRight className="size-5" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href={withLocale("/organizers", locale)} variant="primary" size="lg">
                {dictionary.home.createEvent}
              </ButtonLink>
            </div>
          </div>
          <div className="relative min-h-80 overflow-hidden rounded-lg border border-gray-200 bg-gray-950 shadow-soft">
            <Image src="/racedz-logo.png" alt="RaceDZ route pin logo" fill priority sizes="(min-width: 768px) 40vw, 100vw" className="object-cover opacity-90" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent p-5 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="size-4 text-brand-orange" aria-hidden="true" />
                {dictionary.home.heroNote}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-brand-teal">{dictionary.home.upcomingEyebrow}</p>
            <h2 className="text-2xl font-black text-gray-950">{dictionary.home.upcomingTitle}</h2>
          </div>
          <ButtonLink href={withLocale("/races", locale)} variant="outline" size="sm">
            {dictionary.home.browseAll}
          </ButtonLink>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {upcomingRaces.map((race) => (
            <RaceCard key={race.id} race={race} viewLabel={dictionary.common.view} locale={locale} />
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6">
            <p className="text-sm font-bold text-brand-teal">{dictionary.home.raceTypesEyebrow}</p>
            <h2 className="text-2xl font-black text-gray-950">{dictionary.home.raceTypesTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {raceTypes.map((item) => (
              <div key={item.label} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                <item.icon className="mb-4 size-7 text-brand-orange" aria-hidden="true" />
                <h3 className="font-bold text-gray-950">{item.label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 rounded-lg bg-brand-teal p-6 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-2xl font-black">{dictionary.home.organizerTitle}</h2>
            <p className="mt-2 text-teal-50">{dictionary.home.organizerText}</p>
          </div>
          <ButtonLink href={withLocale("/organizers", locale)} variant="primary" size="lg">
            {dictionary.home.createEvent}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
