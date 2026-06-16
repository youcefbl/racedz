import Link from "next/link";
import { CalendarDays, Mail, Phone, ReceiptText, Route, UserRound } from "lucide-react";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getAdminRegistrations, requireAdmin } from "@/lib/admin";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminRegistrationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    paymentStatus?: string;
  }>;
};

export default async function AdminRegistrationsPage({ searchParams }: AdminRegistrationsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const registrations = await getAdminRegistrations({
    q: filters?.q,
    status: filters?.status,
    paymentStatus: filters?.paymentStatus
  });

  return (
    <AdminShell title="Registrations" description="Review participant registrations, payment state, and race entry details.">
      <FilterBar action="/admin/registrations" searchPlaceholder="Search runner, email, race, distance">
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
          name="paymentStatus"
          label="All payment states"
          defaultValue={filters?.paymentStatus}
          options={[
            { value: "NOT_REQUIRED", label: "Not required" },
            { value: "PENDING", label: "Pending" },
            { value: "PAID", label: "Paid" },
            { value: "FAILED", label: "Failed" },
            { value: "REFUNDED", label: "Refunded" },
            { value: "MANUAL_REVIEW", label: "Manual review" }
          ]}
        />
      </FilterBar>

      {registrations.length === 0 ? (
        <EmptyState title="No registrations found" description="There are no registrations matching the current filters." />
      ) : (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {registrations.map((registration) => (
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
                    <td className="px-4 py-4">
                      <Link href={`/races/${registration.raceEvent.slug}`} className="font-bold text-gray-950 transition hover:text-brand-teal">
                        {registration.raceEvent.title}
                      </Link>
                      <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {formatDateTime(registration.raceEvent.startDate)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      <p className="flex items-center gap-2">
                        <Route className="size-4 text-brand-teal" aria-hidden="true" />
                        {registration.raceCategory.name}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <ReceiptText className="size-3.5" aria-hidden="true" />
                        {registration.raceCategory.distanceKm}K · {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={registration.status} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={registration.paymentStatus} />
                    </td>
                    <td className="px-4 py-4 text-gray-600">{formatDateTime(registration.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
