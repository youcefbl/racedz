import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, Mail, MapPin, Megaphone, Phone, ReceiptText, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RaceMedia } from "@/components/races/race-media";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { getRaceEventBySlug } from "@/lib/race-repository";
import { EVENT_REGISTRATION_STATUS_LABELS, RACE_TYPE_LABELS } from "@/lib/races";
import { getUserRaceRegistration } from "@/lib/registrations";
import type { PaymentStatus, RegistrationStatus } from "@/types/race";

export const dynamic = "force-dynamic";

type RaceDetailsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params }: RaceDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const race = await getRaceEventBySlug(slug);

  if (!race) {
    return { title: "Race not found" };
  }

  return {
    title: race.title,
    description: race.description
  };
}

export default async function RaceDetailsPage({ params, searchParams }: RaceDetailsPageProps) {
  const { slug } = await params;
  const race = await getRaceEventBySlug(slug);

  if (!race) {
    notFound();
  }

  const locale = getLocale((await searchParams)?.lang);
  const dictionary = getDictionary(locale);
  const canRegister = race.registrationStatus === "OPEN";
  const currentUser = await getCurrentUser();
  const currentRegistration = currentUser ? await getUserRaceRegistration(currentUser.id, race.id) : null;

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
          <div className="space-y-6">
            <RaceMedia
              src={race.mainImageUrl}
              alt={`${race.title} race image`}
              sizes="(min-width: 768px) 60vw, 100vw"
              priority
              className="min-h-96 rounded-lg border border-gray-200 sm:min-h-[30rem]"
            />
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="teal">{RACE_TYPE_LABELS[race.raceType]}</Badge>
                <Badge variant={canRegister ? "green" : "blue"}>
                  {EVENT_REGISTRATION_STATUS_LABELS[race.registrationStatus]}
                </Badge>
                {race.source === "PLATFORM" ? <Badge variant="blue">RaceDZ platform-created</Badge> : null}
                <Badge variant="orange">{race.wilaya}</Badge>
              </div>
              <h1 className="text-3xl font-black text-gray-950 sm:text-4xl">{race.title}</h1>
              <p className="max-w-3xl text-base leading-7 text-gray-600">{race.description}</p>
              {race.elevationGainText ? (
                <p className="max-w-3xl text-sm font-semibold text-gray-700">
                  {dictionary.raceDetail.eventElevationGain}: {race.elevationGainText}
                </p>
              ) : null}
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-5 text-brand-teal" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-950">{formatDateTime(race.startDate)}</p>
                  {race.registrationCloseAt ? (
                    <p className="text-sm text-gray-500">
                      {dictionary.raceDetail.registrationCloses.replace("{date}", formatDateTime(race.registrationCloseAt))}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-5 text-brand-teal" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-950">
                    {race.city}, {race.wilaya}
                  </p>
                  <p className="text-sm text-gray-500">{race.address}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Building2 className="mt-0.5 size-5 text-brand-teal" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-950">{race.organizer.name}</p>
                  <p className="text-sm text-gray-500">{dictionary.raceDetail.organizerLabel}</p>
                </div>
              </div>
              {race.availablePlaces != null ? (
                <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-700">
                  {dictionary.raceDetail.placesAvailable
                    .replace("{available}", String(race.availablePlaces))
                    .replace("{total}", String(race.maxParticipants ?? "—"))}
                </p>
              ) : null}
              {currentRegistration ? (
                <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={registrationBadgeVariant[currentRegistration.status as RegistrationStatus]}>
                      {formatEnumLabel(currentRegistration.status)}
                    </Badge>
                    <Badge variant={paymentBadgeVariant[currentRegistration.paymentStatus as PaymentStatus]}>
                      {formatEnumLabel(currentRegistration.paymentStatus)}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-base font-black text-gray-950">Your registration</h2>
                  <div className="mt-3 grid gap-2 text-sm text-gray-700">
                    <p className="flex items-center gap-2">
                      <Route className="size-4 text-brand-teal" aria-hidden="true" />
                      {currentRegistration.raceCategory.name} · {currentRegistration.raceCategory.distanceKm}K
                    </p>
                    <p className="flex items-center gap-2">
                      <ReceiptText className="size-4 text-brand-teal" aria-hidden="true" />
                      {formatDzd(currentRegistration.raceCategory.priceDzd ?? undefined)}
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-brand-teal" aria-hidden="true" />
                      Registered {formatDateTime(currentRegistration.createdAt)}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <ButtonLink href="/account/registrations" variant="secondary" size="sm">
                      View registration details
                    </ButtonLink>
                    {canRegister ? (
                      <ButtonLink href={withLocale(`/races/${race.slug}/register`, locale)} variant="outline" size="sm">
                        Register another distance
                      </ButtonLink>
                    ) : null}
                  </div>
                </div>
              ) : canRegister ? (
                <ButtonLink href={withLocale(`/races/${race.slug}/register`, locale)} className="w-full" size="lg">
                  {dictionary.raceDetail.registerNow}
                </ButtonLink>
              ) : (
                <p className="rounded-lg border border-gray-200 p-3 text-sm font-semibold text-gray-600">
                  {dictionary.raceDetail.registrationClosed.replace(
                    "{status}",
                    EVENT_REGISTRATION_STATUS_LABELS[race.registrationStatus].toLowerCase()
                  )}
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <section className="space-y-6">
          {race.announcements && race.announcements.length > 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="size-5 text-brand-orange" aria-hidden="true" />
                <h2 className="text-xl font-black text-gray-950">Race announcements</h2>
              </div>
              <div className="grid gap-3">
                {race.announcements.map((announcement) => (
                  <article key={announcement.id} className="rounded-lg border border-gray-200 bg-orange-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-normal text-brand-orange">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short"
                      }).format(new Date(announcement.publishedAt))}
                    </p>
                    <h3 className="mt-2 text-base font-black text-gray-950">{announcement.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-700">{announcement.body}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-xl font-black text-gray-950">{dictionary.raceDetail.categoriesTitle}</h2>
            <div className="grid gap-3">
              {race.categories.map((category) => (
                <div key={category.id} className="grid gap-2 rounded-lg border border-gray-200 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-950">{category.name}</h3>
                      <Badge variant="teal">{RACE_TYPE_LABELS[category.raceType ?? race.raceType]}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {category.distanceKm}K
                      {category.elevationGainM
                        ? ` · ${dictionary.raceDetail.elevationGain.replace("{meters}", String(category.elevationGainM))}`
                        : ""}
                      {category.cutoffTimeMin
                        ? ` · ${dictionary.raceDetail.cutoffTime.replace("{hours}", String(category.cutoffTimeMin / 60))}`
                        : ""}
                    </p>
                  </div>
                  <p className="font-bold text-gray-950">{formatDzd(category.priceDzd)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-xl font-black text-gray-950">{dictionary.raceDetail.rulesTitle}</h2>
            <p className="text-sm leading-6 text-gray-600">{race.rules ?? dictionary.raceDetail.noRules}</p>
          </div>

          {race.conditions ? (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-xl font-black text-gray-950">{dictionary.raceDetail.conditionsTitle}</h2>
              <p className="whitespace-pre-line text-sm leading-6 text-gray-600">{race.conditions}</p>
            </div>
          ) : null}

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-xl font-black text-gray-950">{dictionary.raceDetail.documentsTitle}</h2>
            <p className="text-sm leading-6 text-gray-600">{race.requiredDocuments ?? dictionary.raceDetail.noDocuments}</p>
          </div>
        </section>

        <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-black text-gray-950">{dictionary.raceDetail.contactTitle}</h2>
          <div className="space-y-3 text-sm text-gray-600">
            {race.contactEmail ? (
              <a
                href={`mailto:${race.contactEmail}`}
                className="flex items-center gap-2 transition hover:text-brand-teal"
              >
                <Mail className="size-4 text-brand-teal" aria-hidden="true" />
                {race.contactEmail}
              </a>
            ) : null}
            {race.contactPhone ? (
              <a href={`tel:${race.contactPhone}`} className="flex items-center gap-2 transition hover:text-brand-teal">
                <Phone className="size-4 text-brand-teal" aria-hidden="true" />
                {race.contactPhone}
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

const registrationBadgeVariant: Record<RegistrationStatus, "blue" | "green" | "red" | "orange" | "default"> = {
  PENDING: "orange",
  CONFIRMED: "green",
  CANCELLED: "default",
  REJECTED: "red",
  WAITING_LIST: "blue"
};

const paymentBadgeVariant: Record<PaymentStatus, "blue" | "green" | "red" | "orange" | "default"> = {
  NOT_REQUIRED: "green",
  PENDING: "orange",
  PAID: "green",
  FAILED: "red",
  REFUNDED: "blue",
  MANUAL_REVIEW: "blue"
};

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
