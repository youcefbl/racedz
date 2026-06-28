import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, MapPin, ReceiptText, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/auth";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getUserRegistrations } from "@/lib/registrations";
import type { PaymentStatus, RegistrationStatus } from "@/types/race";

export const dynamic = "force-dynamic";

type AccountRegistrationsPageProps = {
  searchParams?: Promise<{
    registered?: string;
    lang?: string;
  }>;
};

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

export default async function AccountRegistrationsPage({ searchParams }: AccountRegistrationsPageProps) {
  const session = await auth();
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = getDictionary(locale).registrations;
  const statusLabels = getDictionary(locale).status;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/registrations");
  }

  const registrations = await getUserRegistrations(session.user.id);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-950">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              {t.intro}
            </p>
          </div>
          <ButtonLink href="/races" variant="secondary">
            {t.findAnother}
          </ButtonLink>
        </div>

        {params?.registered ? (
          <div className="mb-5 rounded-lg border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
            {t.savedBanner}
          </div>
        ) : null}

        {registrations.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={t.emptyTitle}
            description={t.emptyText}
            action={<ButtonLink href="/races">{t.browse}</ButtonLink>}
          />
        ) : (
          <div className="grid gap-4">
            {registrations.map((registration) => (
              <article key={registration.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="space-y-3">
                    <div>
                      <Link
                        href={`/races/${registration.raceEvent.slug}`}
                        className="text-xl font-black leading-snug text-gray-950 transition hover:text-brand-teal"
                      >
                        {registration.raceEvent.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={registrationBadgeVariant[registration.status as RegistrationStatus]}>
                          {statusLabels[registration.status as RegistrationStatus]}
                        </Badge>
                        <Badge variant={paymentBadgeVariant[registration.paymentStatus as PaymentStatus]}>
                          {statusLabels[registration.paymentStatus as PaymentStatus]}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {formatDateTime(registration.raceEvent.startDate)}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {registration.raceEvent.city}, {registration.raceEvent.wilaya}
                      </p>
                      <p className="flex items-center gap-2">
                        <Route className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {registration.raceCategory.name} · {registration.raceCategory.distanceKm}K
                      </p>
                      <p className="flex items-center gap-2">
                        <ReceiptText className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
                        {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:w-44 lg:grid-cols-1">
                    <ButtonLink href={`/races/${registration.raceEvent.slug}`} variant="outline" size="sm">
                      {t.raceDetails}
                    </ButtonLink>
                    <ButtonLink href={`/races/${registration.raceEvent.slug}/register`} variant="secondary" size="sm">
                      {t.addDistance}
                    </ButtonLink>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
