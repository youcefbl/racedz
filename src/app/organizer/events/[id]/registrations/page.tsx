import { notFound } from "next/navigation";
import { CheckCircle2, Mail, Phone, Route, Search, UserRound, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getOrganizerRaceById, getOrganizerRaceRegistrations, requireApprovedOrganizer } from "@/lib/organizer";
import { parsePagination } from "@/lib/pagination";
import { getLocale, withLocale } from "@/lib/i18n";
import { translateOrganizer, translateOrganizerEnum } from "@/lib/organizer-i18n";
import { cancelOrganizerRegistrationAction, confirmOrganizerRegistrationPaymentAction } from "../actions";

export const dynamic = "force-dynamic";

type EventRegistrationsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    q?: string;
    status?: string;
    paymentState?: string;
    page?: string;
    lang?: string;
  }>;
};

export default async function EventRegistrationsPage({ params, searchParams }: EventRegistrationsPageProps) {
  const { id } = await params;
  const filters = await searchParams;
  const locale = getLocale(filters?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const pagination = parsePagination({ page: filters?.page });
  const { organization } = await requireApprovedOrganizer();
  const [race, registrationResult] = await Promise.all([
    getOrganizerRaceById(organization.id, id),
    getOrganizerRaceRegistrations(
      organization.id,
      id,
      {
        q: filters?.q,
        status: filters?.status,
        paymentState: filters?.paymentState
      },
      pagination
    )
  ]);

  if (!race) {
    notFound();
  }

  const registrations = registrationResult.items;

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer")}</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{race.title} · {t("Registrations")}</h1>
          </div>
          <ButtonLink href={`/api/organizer/events/${race.id}/registrations/export`} variant="outline">
            {t("Export CSV")}
          </ButtonLink>
        </div>

        <form
          action={`/organizer/events/${race.id}/registrations`}
          className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm lg:grid-cols-[1fr_auto]"
        >
          <input type="hidden" name="lang" value={locale} />
          <label className="relative">
            <span className="sr-only">{t("Search registrations")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              name="q"
              defaultValue={filters?.q ?? ""}
              placeholder={t("Search runner, email, distance")}
              className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <SelectFilter
              name="status"
              label={t("All registration statuses")}
              defaultValue={filters?.status}
              options={[
                { value: "PENDING", label: t("Pending") },
                { value: "CONFIRMED", label: t("Confirmed") },
                { value: "CANCELLED", label: t("Cancelled") },
                { value: "REJECTED", label: t("Rejected") },
                { value: "WAITING_LIST", label: t("Waiting list") }
              ]}
            />
            <SelectFilter
              name="paymentState"
              label={t("All payment states")}
              defaultValue={filters?.paymentState}
              options={[
                { value: "CONFIRMED", label: t("Payment confirmed") },
                { value: "NOT_CONFIRMED", label: t("Payment not confirmed") }
              ]}
            />
            <Button type="submit" size="sm" variant="secondary">
              {t("Filter")}
            </Button>
            <ButtonLink href={withLocale(`/organizer/events/${race.id}/registrations`, locale)} size="sm" variant="outline">
              {t("Reset")}
            </ButtonLink>
          </div>
        </form>

        {registrations.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-gray-950">{t("No participants found")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              {t("Registrations will appear here after runners sign up, or when the current filters match existing participants.")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-normal text-gray-500">
                    <tr>
                      <th className="px-4 py-3">{t("Runner")}</th>
                      <th className="px-4 py-3">{t("Distance")}</th>
                      <th className="px-4 py-3">{t("Status")}</th>
                      <th className="px-4 py-3">{t("Payment")}</th>
                      <th className="px-4 py-3">{t("Registered")}</th>
                      <th className="px-4 py-3">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {registrations.map((registration) => {
                      const canConfirmPayment = registration.paymentStatus !== "PAID" && registration.paymentStatus !== "NOT_REQUIRED" && registration.status !== "CANCELLED" && registration.status !== "REJECTED";
                      const canCancel = registration.status !== "CANCELLED" && registration.status !== "REJECTED";

                      return (
                        <tr key={registration.id}>
                          <td className="px-4 py-4">
                            <div className="flex gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                                <UserRound className="size-5" aria-hidden="true" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-950">
                                  {registration.user.firstName} {registration.user.lastName}
                                </p>
                                <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                  <Mail className="size-3.5" aria-hidden="true" />
                                  {registration.user.email}
                                </p>
                                {registration.user.phone ? (
                                  <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                    <Phone className="size-3.5" aria-hidden="true" />
                                    {registration.user.phone}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            <p className="flex items-center gap-2">
                              <Route className="size-4 text-brand-teal" aria-hidden="true" />
                              {registration.raceCategory.name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {registration.raceCategory.distanceKm}K · {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={getStatusVariant(registration.status)}>{translateOrganizerEnum(locale, registration.status)}</Badge>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={getStatusVariant(registration.paymentStatus)}>{translateOrganizerEnum(locale, registration.paymentStatus)}</Badge>
                          </td>
                          <td className="px-4 py-4 text-gray-600">{formatDateTime(registration.createdAt)}</td>
                          <td className="px-4 py-4">
                            <div className="flex min-w-44 flex-wrap gap-2">
                              <form action={confirmOrganizerRegistrationPaymentAction}>
                                <input type="hidden" name="id" value={registration.id} />
                                <input type="hidden" name="raceId" value={race.id} />
                                <Button type="submit" variant="outline" size="sm" disabled={!canConfirmPayment}>
                                  <CheckCircle2 className="size-4" aria-hidden="true" />
                                  {t("Confirm payment")}
                                </Button>
                              </form>
                              <form action={cancelOrganizerRegistrationAction}>
                                <input type="hidden" name="id" value={registration.id} />
                                <input type="hidden" name="raceId" value={race.id} />
                                <Button type="submit" variant="ghost" size="sm" disabled={!canCancel} className="text-red-700 hover:bg-red-50">
                                  <XCircle className="size-4" aria-hidden="true" />
                                  {t("Cancel")}
                                </Button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination
              basePath={`/organizer/events/${race.id}/registrations`}
              searchParams={filters}
              page={registrationResult.page}
              totalPages={registrationResult.totalPages}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SelectFilter({
  name,
  label,
  defaultValue,
  options
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function getStatusVariant(value: string) {
  if (value === "CONFIRMED" || value === "PAID" || value === "NOT_REQUIRED") {
    return "green";
  }

  if (value === "PENDING" || value === "MANUAL_REVIEW" || value === "WAITING_LIST") {
    return "orange";
  }

  if (value === "CANCELLED" || value === "REJECTED" || value === "FAILED" || value === "REFUNDED") {
    return "red";
  }

  return "blue";
}
