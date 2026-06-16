import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, MapPin, Phone, Route } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getRaceEventBySlug } from "@/lib/race-repository";
import { EVENT_REGISTRATION_STATUS_LABELS, RACE_TYPE_LABELS } from "@/lib/races";

type RaceDetailsPageProps = {
  params: Promise<{ slug: string }>;
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

export default async function RaceDetailsPage({ params }: RaceDetailsPageProps) {
  const { slug } = await params;
  const race = await getRaceEventBySlug(slug);

  if (!race) {
    notFound();
  }

  const canRegister = race.registrationStatus === "OPEN";

  return (
    <div className="bg-gray-50">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1fr_380px] lg:px-8">
          <div className="space-y-6">
            <div className="relative min-h-72 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              {race.mainImageUrl ? (
                <Image src={race.mainImageUrl} alt="" fill priority sizes="(min-width: 768px) 60vw, 100vw" className="object-cover" />
              ) : null}
            </div>
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
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-5 text-brand-teal" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-950">{formatDateTime(race.startDate)}</p>
                  {race.registrationCloseAt ? (
                    <p className="text-sm text-gray-500">Registration closes {formatDateTime(race.registrationCloseAt)}</p>
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
                <Route className="mt-0.5 size-5 text-brand-teal" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-gray-950">{race.organizer.name}</p>
                  <p className="text-sm text-gray-500">Organizer</p>
                </div>
              </div>
              {race.availablePlaces != null ? (
                <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-700">
                  {race.availablePlaces} of {race.maxParticipants ?? "many"} places available
                </p>
              ) : null}
              {canRegister ? (
                <ButtonLink href={`/races/${race.slug}/register`} className="w-full" size="lg">
                  Register Now
                </ButtonLink>
              ) : (
                <p className="rounded-lg border border-gray-200 p-3 text-sm font-semibold text-gray-600">
                  Registration is {EVENT_REGISTRATION_STATUS_LABELS[race.registrationStatus].toLowerCase()}.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_340px] lg:px-8">
        <section className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-xl font-black text-gray-950">Distances and categories</h2>
            <div className="grid gap-3">
              {race.categories.map((category) => (
                <div key={category.id} className="grid gap-2 rounded-lg border border-gray-200 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h3 className="font-bold text-gray-950">{category.name}</h3>
                    <p className="text-sm text-gray-500">
                      {category.distanceKm}K
                      {category.elevationGainM ? ` · ${category.elevationGainM}m elevation gain` : ""}
                      {category.cutoffTimeMin ? ` · ${category.cutoffTimeMin / 60}h cut-off` : ""}
                    </p>
                  </div>
                  <p className="font-bold text-gray-950">{formatDzd(category.priceDzd)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-xl font-black text-gray-950">Race rules</h2>
            <p className="text-sm leading-6 text-gray-600">{race.rules ?? "Rules will be published by the organizer."}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-xl font-black text-gray-950">Required documents</h2>
            <p className="text-sm leading-6 text-gray-600">{race.requiredDocuments ?? "No required documents listed yet."}</p>
          </div>
        </section>

        <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-xl font-black text-gray-950">Contact</h2>
          <div className="space-y-3 text-sm text-gray-600">
            {race.contactEmail ? (
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-brand-teal" aria-hidden="true" />
                {race.contactEmail}
              </p>
            ) : null}
            {race.contactPhone ? (
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-brand-teal" aria-hidden="true" />
                {race.contactPhone}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
