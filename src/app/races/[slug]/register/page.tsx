import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Route } from "lucide-react";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPrisma } from "@/lib/db";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { getRaceEventBySlug } from "@/lib/race-repository";
import { EVENT_REGISTRATION_STATUS_LABELS } from "@/lib/races";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Register for race"
};

type RegisterPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { slug } = await params;
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).registration;
  const race = await getRaceEventBySlug(slug);

  if (!race) {
    notFound();
  }

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/races/${race.slug}/register`);
  }

  const user = await getPrisma().user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      gender: true,
      dateOfBirth: true,
      wilaya: true,
      city: true,
      registrations: {
        where: {
          raceEventId: race.id
        },
        select: {
          raceCategoryId: true
        }
      }
    }
  });

  if (!user) {
    redirect(`/login?callbackUrl=/races/${race.slug}/register`);
  }

  const canRegister = race.status === "PUBLISHED" && race.registrationStatus === "OPEN";
  const existingCategoryIds = user.registrations.map((registration) => registration.raceCategoryId);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section className="space-y-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950 sm:text-4xl">{race.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              {t.intro}
            </p>
          </div>
          <RegistrationForm race={race} user={user} canRegister={canRegister} existingCategoryIds={existingCategoryIds} locale={locale} />
        </section>

        <aside className="h-fit space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={canRegister ? "green" : "blue"}>
              {EVENT_REGISTRATION_STATUS_LABELS[race.registrationStatus]}
            </Badge>
            <Badge variant="orange">{race.wilaya}</Badge>
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-950">{race.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{race.description}</p>
          </div>
          <div className="space-y-3 border-t border-gray-200 pt-4 text-sm">
            <div className="flex gap-3">
              <CalendarDays className="mt-0.5 size-4 text-brand-teal" aria-hidden="true" />
              <div>
                <p className="font-semibold text-gray-950">{formatDateTime(race.startDate)}</p>
                {race.registrationCloseAt ? (
                  <p className="text-gray-500">{t.closes.replace("{date}", formatDateTime(race.registrationCloseAt))}</p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin className="mt-0.5 size-4 text-brand-teal" aria-hidden="true" />
              <div>
                <p className="font-semibold text-gray-950">
                  {race.city}, {race.wilaya}
                </p>
                {race.address ? <p className="text-gray-500">{race.address}</p> : null}
              </div>
            </div>
            <div className="flex gap-3">
              <Route className="mt-0.5 size-4 text-brand-teal" aria-hidden="true" />
              <div>
                <p className="font-semibold text-gray-950">{race.organizer.name}</p>
                <p className="text-gray-500">{t.organizer}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 border-t border-gray-200 pt-4">
            <p className="text-sm font-bold text-gray-950">{t.distances}</p>
            {race.categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-gray-950">{category.name}</p>
                  <p className="text-gray-500">{category.distanceKm}K</p>
                </div>
                <p className="font-bold text-gray-950">{formatDzd(category.priceDzd)}</p>
              </div>
            ))}
          </div>
          <ButtonLink href={withLocale(`/races/${race.slug}`, locale)} variant="outline" className="w-full">
            {t.viewRaceDetails}
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}
