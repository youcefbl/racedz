import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { RaceCard } from "@/components/races/race-card";
import { RaceSearchForm } from "@/components/races/race-search-form";
import { ShowPastToggle } from "@/components/races/show-past-toggle";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";
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
    past?: string;
    lang?: Locale;
  }>;
};

export default async function RacesPage({ searchParams }: RacesPageProps) {
  const filters = (await searchParams) ?? {};
  const locale = getLocale(filters.lang);
  const dictionary = getDictionary(locale);
  const races = await findRaceEvents(filters);
  const hasActiveFilters = Boolean(
    filters.q || filters.wilaya || filters.type || filters.distance || filters.registrationStatus
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-950">{dictionary.races.title}</h1>
      </div>
      <RaceSearchForm
        q={filters.q}
        wilaya={filters.wilaya}
        type={filters.type}
        distance={filters.distance}
        registrationStatus={filters.registrationStatus}
        lang={locale}
        filtersLabel={dictionary.races.filters}
        labels={dictionary.search}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {dictionary.races.resultCount.replace("{count}", String(races.length))}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <ShowPastToggle label={dictionary.races.showPast} />
          {hasActiveFilters ? (
            <Link
              href={withLocale("/races", locale)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              <X className="size-3.5" aria-hidden="true" />
              {dictionary.races.clearFilters}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {races.map((race, index) => (
          <RaceCard key={race.id} race={race} viewLabel={dictionary.common.view} locale={locale} index={index} />
        ))}
      </div>
      {races.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <h2 className="text-lg font-bold text-gray-950">
            {hasActiveFilters ? dictionary.races.emptyFilteredTitle : dictionary.races.emptyTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
            {hasActiveFilters ? dictionary.races.emptyFilteredText : dictionary.races.emptyText}
          </p>
          {hasActiveFilters ? (
            <Link
              href={withLocale("/races", locale)}
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-tealDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
            >
              <X className="size-4" aria-hidden="true" />
              {dictionary.races.clearFilters}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
