import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, MapPin, ReceiptText, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { auth } from "@/auth";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getUserRegistrations } from "@/lib/registrations";
import type { PaymentStatus, RegistrationStatus } from "@/types/race";

export const dynamic = "force-dynamic";

type AccountRegistrationsPageProps = {
  searchParams?: Promise<{
    registered?: string;
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

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/registrations");
  }

  const registrations = await getUserRegistrations(session.user.id);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Account</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">My registrations</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Track your race entries, payment state, and event details from one place.
            </p>
          </div>
          <ButtonLink href="/races" variant="secondary">
            Find another race
          </ButtonLink>
        </div>

        {params?.registered ? (
          <div className="mb-5 rounded-lg border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
            Registration saved. The organizer can now review and confirm your entry.
          </div>
        ) : null}

        {registrations.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-orange-50 text-brand-orange">
              <ReceiptText className="size-6" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-black text-gray-950">No registrations yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              Browse open races and register for the distance that fits your training.
            </p>
            <ButtonLink href="/races" className="mt-5">
              Browse races
            </ButtonLink>
          </div>
        ) : (
          <div className="grid gap-4">
            {registrations.map((registration) => (
              <article key={registration.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={registrationBadgeVariant[registration.status as RegistrationStatus]}>
                        {formatEnumLabel(registration.status)}
                      </Badge>
                      <Badge variant={paymentBadgeVariant[registration.paymentStatus as PaymentStatus]}>
                        {formatEnumLabel(registration.paymentStatus)}
                      </Badge>
                    </div>
                    <div>
                      <Link
                        href={`/races/${registration.raceEvent.slug}`}
                        className="text-xl font-black text-gray-950 transition hover:text-brand-teal"
                      >
                        {registration.raceEvent.title}
                      </Link>
                      <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                        <p className="flex items-center gap-2">
                          <CalendarDays className="size-4 text-brand-teal" aria-hidden="true" />
                          {formatDateTime(registration.raceEvent.startDate)}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
                          {registration.raceEvent.city}, {registration.raceEvent.wilaya}
                        </p>
                        <p className="flex items-center gap-2">
                          <Route className="size-4 text-brand-teal" aria-hidden="true" />
                          {registration.raceCategory.name} · {registration.raceCategory.distanceKm}K
                        </p>
                        <p className="flex items-center gap-2">
                          <ReceiptText className="size-4 text-brand-teal" aria-hidden="true" />
                          {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:w-44 lg:grid-cols-1">
                    <ButtonLink href={`/races/${registration.raceEvent.slug}`} variant="outline" size="sm">
                      Race details
                    </ButtonLink>
                    <ButtonLink href={`/races/${registration.raceEvent.slug}/register`} variant="secondary" size="sm">
                      Add distance
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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
