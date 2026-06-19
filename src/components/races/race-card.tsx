import Image from "next/image";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDzd } from "@/lib/format";
import { withLocale, type Locale } from "@/lib/i18n";
import { EVENT_REGISTRATION_STATUS_LABELS, RACE_TYPE_LABELS } from "@/lib/races";
import type { EventRegistrationStatus, RaceEvent } from "@/types/race";

type RaceCardProps = {
  race: RaceEvent;
  viewLabel?: string;
  locale?: Locale;
};

export function RaceCard({ race, viewLabel = "View", locale = "en" }: RaceCardProps) {
  const lowestPrice = Math.min(...race.categories.map((category) => category.priceDzd ?? 0));
  const distances = race.categories.map((category) => category.distanceKm);
  const uniqueDistances = Array.from(new Set(distances)).sort((a, b) => a - b);

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="relative h-44 bg-gray-100">
        {race.mainImageUrl ? (
          <Image
            src={race.mainImageUrl}
            alt={`${race.title} race image`}
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover"
          />
        ) : null}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant="teal">{RACE_TYPE_LABELS[race.raceType]}</Badge>
          <Badge variant={getRegistrationBadgeVariant(race.registrationStatus)}>
            {EVENT_REGISTRATION_STATUS_LABELS[race.registrationStatus]}
          </Badge>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {uniqueDistances.map((distance) => (
              <span
                key={distance}
                className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-brand-orangeDark"
              >
                {distance}K
              </span>
            ))}
            {race.source === "PLATFORM" ? (
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                RaceDZ
              </span>
            ) : null}
          </div>
          <h2 className="text-lg font-black text-gray-950">{race.title}</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CalendarDays className="size-4 text-brand-teal" aria-hidden="true" />
            {formatDate(race.startDate)}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
            {race.city}, {race.wilaya}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">From {formatDzd(lowestPrice)}</p>
            {race.availablePlaces != null ? (
              <p className="text-xs text-gray-500">{race.availablePlaces} places available</p>
            ) : null}
          </div>
          <ButtonLink href={withLocale(`/races/${race.slug}`, locale)} variant="secondary" size="sm">
            {viewLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}

function getRegistrationBadgeVariant(status: EventRegistrationStatus) {
  switch (status) {
    case "OPEN":
      return "green";
    case "NOT_OPEN":
      return "blue";
    case "CLOSED":
    case "FULL":
      return "default";
    case "CANCELLED":
      return "red";
  }
}
