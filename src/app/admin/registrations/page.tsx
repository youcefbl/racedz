import Link from "next/link";
import { CalendarDays, CheckCircle2, ClipboardList, Mail, Phone, ReceiptText, Route, UserRound, XCircle } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getAdminRegistrations, requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";
import { cancelRegistrationAction, confirmRegistrationPaymentAction } from "../actions";

export const dynamic = "force-dynamic";

type AdminRegistrationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    paymentStatus?: string;
    paymentState?: string;
    page?: string;
  }>;
};

export default async function AdminRegistrationsPage({ searchParams }: AdminRegistrationsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const { items: registrations, page, totalPages } = await getAdminRegistrations(
    {
      q: filters?.q,
      status: filters?.status,
      paymentStatus: filters?.paymentStatus,
      paymentState: filters?.paymentState
    },
    pagination
  );

  const hasActiveFilters = Boolean(filters?.q || filters?.status || filters?.paymentState || filters?.paymentStatus);

  return (
    <AdminShell title="Registrations" description="Review participant registrations, payment state, and race entry details.">
      <FilterBar action="/admin/registrations" searchPlaceholder="Search runner, email, race, distance" defaultSearch={filters?.q}>
        <SelectFilter
          name="status"
          label="All registration statuses"
          defaultValue={filters?.status}
          options={[
            { value: "PENDING", label: "Pending" },
            { value: "CONFIRMED", label: "Confirmed" },
            { value: "CANCELLED", label: "Cancelled" },
            { value: "REJECTED", label: "Rejected" },
            { value: "WAITING_LIST", label: "Waiting list" }
          ]}
        />
        <SelectFilter
          name="paymentState"
          label="All payment states"
          defaultValue={filters?.paymentState}
          options={[
            { value: "CONFIRMED", label: "Payment confirmed" },
            { value: "NOT_CONFIRMED", label: "Payment not confirmed" }
          ]}
        />
      </FilterBar>

      {registrations.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No registrations found"
          description={hasActiveFilters ? "No registrations match the current filters. Try clearing them to see everything." : "Registrations will appear here as runners sign up for races."}
          action={hasActiveFilters ? (
            <ButtonLink href="/admin/registrations" size="sm" variant="outline">
              Reset filters
            </ButtonLink>
          ) : undefined}
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-normal text-gray-500">
                <tr>
                  <th className="px-4 py-3">Runner</th>
                  <th className="px-4 py-3">Race</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {registrations.map((registration) => {
                  const canConfirmPayment = registration.paymentStatus !== "PAID" && registration.paymentStatus !== "NOT_REQUIRED" && registration.status !== "CANCELLED" && registration.status !== "REJECTED";
                  const canCancel = registration.status !== "CANCELLED" && registration.status !== "REJECTED";

                  return (
                    <tr key={registration.id}>
                    <td className="px-4 py-4 align-top">
                      <div className="flex gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                          <UserRound className="size-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-950">
                            {registration.user.firstName} {registration.user.lastName}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="break-all">{registration.user.email}</span>
                          </p>
                          {registration.user.phone ? (
                            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                              {registration.user.phone}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Link href={`/races/${registration.raceEvent.slug}`} className="font-bold text-gray-950 transition hover:text-brand-teal">
                        {registration.raceEvent.title}
                      </Link>
                      <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                        {formatDateTime(registration.raceEvent.startDate)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-gray-600">
                      <p className="flex items-center gap-2">
                        <Route className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                        {registration.raceCategory.name}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <ReceiptText className="size-3.5 shrink-0" aria-hidden="true" />
                        {registration.raceCategory.distanceKm}K · {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge value={registration.status} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge value={registration.paymentStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 align-top text-gray-600">{formatDateTime(registration.createdAt)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col items-stretch gap-1.5">
                        <form action={confirmRegistrationPaymentAction}>
                          <input type="hidden" name="id" value={registration.id} />
                          <Button type="submit" variant="outline" size="sm" disabled={!canConfirmPayment} className="h-10 w-full whitespace-nowrap">
                            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                            Confirm payment
                          </Button>
                        </form>
                        <form action={cancelRegistrationAction}>
                          <input type="hidden" name="id" value={registration.id} />
                          <Button type="submit" variant="ghost" size="sm" disabled={!canCancel} className="h-10 w-full whitespace-nowrap text-red-700 hover:bg-red-50 disabled:text-gray-400">
                            <XCircle className="size-4 shrink-0" aria-hidden="true" />
                            Cancel
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
          <Pagination basePath="/admin/registrations" searchParams={filters} page={page} totalPages={totalPages} />
        </div>
        </div>
      )}
    </AdminShell>
  );
}
