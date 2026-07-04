import { ArrowRight, CalendarDays, MapPin, Route, Trophy, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { RaceCard } from "@/components/races/race-card";
import { RaceSearchForm } from "@/components/races/race-search-form";
import { EmptyState } from "@/components/ui/empty-state";
import { ZidRunMark } from "@/components/layout/racedz-logo";
import { PanelBrandMark } from "@/components/layout/panel-brand-mark";
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
    { label: dictionary.home.roadRaces, icon: Route, type: "ROAD" },
    { label: dictionary.home.trailRaces, icon: MapPin, type: "TRAIL" },
    { label: dictionary.home.marathons, icon: Trophy, type: "MARATHON" },
    { label: dictionary.home.kidsRaces, icon: UsersRound, type: "KIDS" }
  ];

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* Hero */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-center lg:px-8 lg:py-16">
          <div className="space-y-7">
            <div className="rz-fade-up inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-brand-teal">
              <ZidRunMark className="size-4" animated />
              {dictionary.home.eyebrow}
            </div>
            <div className="rz-fade-up-2 space-y-4">
              <h1 className="max-w-3xl text-4xl font-black leading-[1.05] text-gray-950 sm:text-5xl lg:text-6xl">
                {dictionary.home.title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-gray-600">
                {dictionary.home.subtitle}
              </p>
            </div>
            <RaceSearchForm lang={locale} labels={dictionary.search} hideFilters />
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={withLocale("/races", locale)} variant="primary" size="lg">
                {dictionary.home.findRace}
                <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href={withLocale("/organizers", locale)} variant="outline" size="lg">
                {dictionary.home.createEvent}
              </ButtonLink>
            </div>
          </div>

          {/* Branded velocity panel */}
          <div className="relative min-h-[20rem] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal via-[#0c5650] to-[#0a3a36] p-8 text-white shadow-soft">
            <PanelBrandMark className="-end-10 -top-14 w-72 sm:w-80" />
            <div className="relative flex h-full min-h-[18rem] flex-col justify-between gap-8">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide backdrop-blur">
                <span className="size-2 animate-pulse rounded-full bg-brand-orange" aria-hidden="true" />
                {dictionary.home.upcomingTitle}
              </span>
              <div>
                <p className="text-2xl font-black leading-tight sm:text-3xl">{dictionary.home.raceTypesTitle}</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold backdrop-blur">
                  <CalendarDays className="size-4 text-brand-orange" aria-hidden="true" />
                  {dictionary.home.heroNote}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming races */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-950 sm:text-3xl">{dictionary.home.upcomingTitle}</h2>
          </div>
          <ButtonLink href={withLocale("/races", locale)} variant="outline" size="sm">
            {dictionary.home.browseAll}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </ButtonLink>
        </div>
        {upcomingRaces.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-3">
            {upcomingRaces.map((race) => (
              <RaceCard key={race.id} race={race} viewLabel={dictionary.common.view} locale={locale} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={dictionary.races.emptyTitle}
            description={dictionary.races.emptyText}
            action={
              <ButtonLink href={withLocale("/races", locale)} variant="outline" size="md">
                {dictionary.home.browseAll}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
              </ButtonLink>
            }
          />
        )}
      </section>

      {/* Race types */}
      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-gray-950 sm:text-3xl">{dictionary.home.raceTypesTitle}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {raceTypes.map((item) => (
              <a
                key={item.label}
                href={withLocale(`/races?type=${item.type}`, locale)}
                className="group rounded-xl border border-gray-200 bg-gray-50 p-5 transition hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-orange-50 text-brand-orange transition group-hover:bg-brand-teal group-hover:text-white">
                  <item.icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="flex items-center justify-between font-bold text-gray-950">
                  {item.label}
                  <ArrowRight className="size-4 text-gray-300 transition group-hover:text-brand-teal rtl:rotate-180" aria-hidden="true" />
                </h3>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Organizer CTA */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="relative grid gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-teal to-[#0a3a36] p-8 text-white shadow-soft md:grid-cols-[1fr_auto] md:items-center">
          <PanelBrandMark className="-end-10 -top-10 w-56 sm:w-64" />
          <div className="relative">
            <h2 className="text-2xl font-black sm:text-3xl">{dictionary.home.organizerTitle}</h2>
            <p className="mt-2 max-w-xl text-teal-50">{dictionary.home.organizerText}</p>
          </div>
          <ButtonLink href={withLocale("/organizers", locale)} variant="primary" size="lg" className="relative">
            {dictionary.home.createEvent}
            <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
