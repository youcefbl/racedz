import Link from "next/link";
import { CalendarDays, MapPin, Route, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getOrganizerRaces, requireApprovedOrganizer } from "@/lib/organizer";
import { getLocale, withLocale } from "@/lib/i18n";
import { translateOrganizer, translateOrganizerEnum } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

type OrganizerEventsPageProps = {
  searchParams?: Promise<{
    created?: string;
    lang?: string;
  }>;
};

export default async function OrganizerEventsPage({ searchParams }: OrganizerEventsPageProps) {
  const { organization } = await requireApprovedOrganizer();
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const races = await getOrganizerRaces(organization.id);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer")}</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{t("Events")}</h1>
            <p className="mt-2 text-sm text-gray-600">Manage events owned by {organization.name}.</p>
          </div>
          <ButtonLink href={withLocale("/organizer/events/new", locale)}>{t("Create Event")}</ButtonLink>
        </div>

        {params?.created ? (
          <div className="mb-5 rounded-lg border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
            {t("Event submitted for admin review. It will stay hidden from the public site until approved.")}
          </div>
        ) : null}

        {races.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-gray-950">{t("No events yet")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              {t("Create your first race and submit it for RaceDZ admin review.")}
            </p>
            <ButtonLink href={withLocale("/organizer/events/new", locale)} className="mt-5">
              {t("Create Event")}
            </ButtonLink>
          </div>
        ) : (
          <div className="grid gap-4">
            {races.map((race) => {
              const lowestPrice = getLowestPrice(race.categories.map((category) => category.priceDzd));

              return (
                <article key={race.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={race.status === "PUBLISHED" ? "green" : race.status === "REJECTED" ? "red" : "orange"}>
                          {translateOrganizerEnum(locale, race.status)}
                        </Badge>
                        <Badge variant="blue">{translateOrganizerEnum(locale, race.registrationStatus)}</Badge>
                      </div>
                      <div>
                        <Link href={withLocale(`/organizer/events/${race.id}`, locale)} className="text-xl font-black text-gray-950 transition hover:text-brand-teal">
                          {race.title}
                        </Link>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">{race.description}</p>
                      </div>
                      <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="size-4 text-brand-teal" aria-hidden="true" />
                          {formatDateTime(race.startDate)}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
                          {race.city}, {race.wilaya}
                        </p>
                        <p className="flex items-center gap-2">
                          <Route className="size-4 text-brand-teal" aria-hidden="true" />
                          {race._count.categories} categories · from {formatDzd(lowestPrice)}
                        </p>
                        <p className="flex items-center gap-2">
                          <UsersRound className="size-4 text-brand-teal" aria-hidden="true" />
                          {race._count.registrations} registrations
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:w-44 lg:grid-cols-1">
                      <ButtonLink href={withLocale(`/organizer/events/${race.id}`, locale)} variant="outline" size="sm">
                        {t("Overview")}
                      </ButtonLink>
                      <ButtonLink href={withLocale(`/organizer/events/${race.id}/registrations`, locale)} variant="secondary" size="sm">
                        {t("Registrations")}
                      </ButtonLink>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getLowestPrice(prices: Array<number | null>) {
  const values = prices.filter((value): value is number => typeof value === "number");

  return values.length ? Math.min(...values) : undefined;
}
