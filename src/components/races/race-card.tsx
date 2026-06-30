import type { CSSProperties } from "react";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { RaceMedia } from "@/components/races/race-media";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDzd } from "@/lib/format";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";
import { EVENT_REGISTRATION_STATUS_LABELS, RACE_TYPE_LABELS, isPastRace } from "@/lib/races";
import type { EventRegistrationStatus, RaceEvent } from "@/types/race";

type RaceCardProps = {
  race: RaceEvent;
  viewLabel?: string;
  locale?: Locale;
  index?: number;
};

export function RaceCard({ race, viewLabel = "View", locale = "en", index = 0 }: RaceCardProps) {
  const dict = getDictionary(locale);
  const t = dict.ui;
  const isPast = isPastRace(race);
  const pricedCategories = race.categories.filter((category) => category.priceDzd != null);
  const lowestPrice = pricedCategories.length
    ? Math.min(...pricedCategories.map((category) => category.priceDzd as number))
    : null;
  const distances = race.categories.map((category) => category.distanceKm);
  const uniqueDistances = Array.from(new Set(distances)).sort((a, b) => a - b);

  return (
    <article
      className="rz-card-enter overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-soft"
      style={{ "--i": Math.min(index, 8) } as CSSProperties}
    >
      <RaceMedia
        src={race.mainImageUrl}
        alt={t.raceImageAlt.replace("{title}", race.title)}
        sizes="(min-width: 768px) 33vw, 100vw"
        className="h-56"
        backdrop={false}
      >
        <div className="absolute start-3 top-3 flex flex-wrap gap-2">
          <Badge variant="teal">{RACE_TYPE_LABELS[race.raceType]}</Badge>
          {isPast ? (
            <Badge variant="default">{dict.races.completed}</Badge>
          ) : (
            <Badge variant={getRegistrationBadgeVariant(race.registrationStatus)}>
              {EVENT_REGISTRATION_STATUS_LABELS[race.registrationStatus]}
            </Badge>
          )}
        </div>
      </RaceMedia>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {uniqueDistances.map((distance) => (
              <span
                key={distance}
                className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-semibold text-brand-orangeText"
              >
                {distance}K
              </span>
            ))}
            {race.source === "PLATFORM" ? (
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                ZidRun
              </span>
            ) : null}
          </div>
          <h2 className="line-clamp-2 text-lg font-bold text-gray-950">{race.title}</h2>
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
            {lowestPrice != null ? (
              <p className="text-sm font-semibold text-gray-900">{t.from.replace("{price}", formatDzd(lowestPrice))}</p>
            ) : null}
            {race.availablePlaces != null ? (
              <p className="text-xs text-gray-500">{t.placesAvailable.replace("{count}", String(race.availablePlaces))}</p>
            ) : null}
          </div>
          <ButtonLink href={withLocale(`/races/${race.slug}`, locale)} variant="secondary" size="md" className="group/btn">
            {viewLabel}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover/btn:translate-x-0.5" aria-hidden="true" />
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
