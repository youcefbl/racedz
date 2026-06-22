import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Megaphone, Route, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { getRaceAnnouncements } from "@/lib/announcements";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getOrganizerRaceById, requireApprovedOrganizer } from "@/lib/organizer";
import { createOrganizerAnnouncementAction, updateRegistrationStatusAction } from "./actions";
import { getLocale, withLocale } from "@/lib/i18n";
import { translateOrganizer, translateOrganizerEnum } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

type OrganizerEventPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function OrganizerEventPage({ params, searchParams }: OrganizerEventPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const { id } = await params;
  const { organization } = await requireApprovedOrganizer();
  const race = await getOrganizerRaceById(organization.id, id);

  if (!race) {
    notFound();
  }
  const announcements = await getRaceAnnouncements(race.id);

  const now = new Date();
  const openBlockReason =
    race.startDate <= now
      ? "Race start date has passed."
      : race.registrationCloseAt && race.registrationCloseAt <= now
        ? "Registration deadline has passed."
        : race._count.categories === 0
          ? "Add at least one category first."
          : race.availablePlaces != null && race.availablePlaces <= 0
            ? "Race capacity is full."
            : null;

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer event")}</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{race.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={race.status === "PUBLISHED" ? "green" : race.status === "REJECTED" ? "red" : "orange"}>
                {translateOrganizerEnum(locale, race.status)}
              </Badge>
              <Badge variant="blue">{translateOrganizerEnum(locale, race.registrationStatus)}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={withLocale(`/organizer/events/${race.id}/registrations`, locale)} variant="secondary">
              {t("Registrations")}
            </ButtonLink>
            <ButtonLink href={withLocale(`/organizer/events/${race.id}/edit`, locale)} variant="outline">
              {t("Edit event")}
            </ButtonLink>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-5">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-gray-950">{t("Overview")}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{race.description}</p>
              {race.elevationGainText ? <p className="mt-2 text-sm font-semibold text-gray-700">{t("Elevation gain")}: {race.elevationGainText}</p> : null}
              {race.conditions ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600"><strong>{t("Conditions")}:</strong> {race.conditions}</p> : null}
              <div className="mt-5 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                <p className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-brand-teal" aria-hidden="true" />
                  {formatDateTime(race.startDate)}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
                  {race.city}, {race.wilaya}
                </p>
                <p className="flex items-center gap-2">
                  <UsersRound className="size-4 text-brand-teal" aria-hidden="true" />
                  {race._count.registrations} {t("Registrations")}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-gray-950">{t("Categories")}</h2>
              <div className="mt-4 grid gap-3">
                {race.categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
                    <div>
                      <p className="font-bold text-gray-950">{category.name}</p>
                      <p className="text-sm text-gray-500">
                        {translateOrganizerEnum(locale, category.raceType ?? race.raceType)} · {category.distanceKm}K
                        {category.maxParticipants ? ` · ${category.maxParticipants} places` : ""}
                      </p>
                    </div>
                    <p className="font-bold text-gray-950">{formatDzd(category.priceDzd ?? undefined)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="size-5 text-brand-orange" aria-hidden="true" />
                <h2 className="text-xl font-black text-gray-950">{t("Announcements")}</h2>
              </div>
              <form action={createOrganizerAnnouncementAction} className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <input type="hidden" name="raceId" value={race.id} />
                <label className="grid gap-1 text-sm font-semibold text-gray-700">
                  {t("Title")}
                  <input
                    name="title"
                    required
                    maxLength={120}
                    className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-950"
                    placeholder="Race pack collection update"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-gray-700">
                  {t("Message")}
                  <textarea
                    name="body"
                    required
                    rows={4}
                    maxLength={2000}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                    placeholder="Write a short update for registered runners and public visitors."
                  />
                </label>
                <Button type="submit" variant="secondary" size="sm" className="w-fit">
                  {t("Publish announcement")}
                </Button>
              </form>
              <div className="mt-4 grid gap-3">
                {announcements.length > 0 ? (
                  announcements.map((announcement) => (
                    <article key={announcement.id} className="rounded-lg border border-gray-200 p-4">
                      <p className="text-xs font-bold uppercase tracking-normal text-brand-teal">{formatDateTime(announcement.publishedAt)}</p>
                      <h3 className="mt-2 font-black text-gray-950">{announcement.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{announcement.body}</p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-600">{t("No announcements yet.")}</p>
                )}
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <Route className="mb-3 size-5 text-brand-orange" aria-hidden="true" />
            <h2 className="text-xl font-black text-gray-950">{t("Publication")}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {t("Organization-created races stay hidden from public pages until an admin publishes them.")}
            </p>
            {race.status === "PUBLISHED" ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <form action={updateRegistrationStatusAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <input type="hidden" name="registrationStatus" value="OPEN" />
                  <Button type="submit" size="sm" className="w-full" disabled={race.registrationStatus === "OPEN" || Boolean(openBlockReason)}>
                    {t("Open registration")}
                  </Button>
                </form>
                <form action={updateRegistrationStatusAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <input type="hidden" name="registrationStatus" value="CLOSED" />
                  <Button type="submit" variant="outline" size="sm" className="w-full" disabled={race.registrationStatus === "CLOSED"}>
                    {t("Close registration")}
                  </Button>
                </form>
                <form action={updateRegistrationStatusAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <input type="hidden" name="registrationStatus" value="FULL" />
                  <Button type="submit" variant="outline" size="sm" className="w-full" disabled={race.registrationStatus === "FULL"}>
                    {t("Mark full")}
                  </Button>
                </form>
                <form action={updateRegistrationStatusAction}>
                  <input type="hidden" name="raceId" value={race.id} />
                  <input type="hidden" name="registrationStatus" value="CANCELLED" />
                  <Button type="submit" variant="outline" size="sm" className="w-full" disabled={race.registrationStatus === "CANCELLED"}>
                    {t("Cancel registration")}
                  </Button>
                </form>
                {openBlockReason ? (
                  <p className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700 sm:col-span-2 lg:col-span-1">
                    {t(openBlockReason)}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700">
                {t("Registration controls unlock after publication.")}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
