import type { Metadata } from "next";
import { RaceCard } from "@/components/races/race-card";
import { RaceSearchForm } from "@/components/races/race-search-form";
import { getDictionary, getLocale, type Locale } from "@/lib/i18n";
import { findRaceEvents } from "@/lib/race-repository";
import type { EventRegistrationStatus, RaceType } from "@/types/race";

export const metadata: Metadata = {
  title: "Races",
  description: "Browse upcoming running races and trail events in Algeria."
};

type RacesPageProps = {
  searchParams?: Promise<{
    q?: string;
    wilaya?: string;
    type?: RaceType;
    distance?: string;
    registrationStatus?: EventRegistrationStatus;
    lang?: Locale;
  }>;
};

export default async function RacesPage({ searchParams }: RacesPageProps) {
  const filters = (await searchParams) ?? {};
  const locale = getLocale(filters.lang);
  const dictionary = getDictionary(locale);
  const races = await findRaceEvents(filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mb-6 space-y-2">
        <p className="text-sm font-bold text-brand-teal">{dictionary.races.eyebrow}</p>
        <h1 className="text-3xl font-black text-gray-950">{dictionary.races.title}</h1>
      </div>
      <RaceSearchForm
        q={filters.q}
        wilaya={filters.wilaya}
        type={filters.type}
        distance={filters.distance}
        registrationStatus={filters.registrationStatus}
        lang={locale}
        labels={dictionary.search}
      />
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {races.map((race) => (
          <RaceCard key={race.id} race={race} viewLabel={dictionary.common.view} locale={locale} />
        ))}
      </div>
      {races.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <h2 className="text-lg font-bold text-gray-950">{dictionary.races.emptyTitle}</h2>
          <p className="mt-2 text-sm text-gray-500">{dictionary.races.emptyText}</p>
        </div>
      ) : null}
    </div>
  );
}
