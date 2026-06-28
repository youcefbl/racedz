import Image from "next/image";
import { Building2, Mail, MapPin, Phone, UserRound, Users } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import { getAdminOrganizations, requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { approveOrganizationAction, rejectOrganizationAction } from "../actions";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminOrganizationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
};

export default async function AdminOrganizationsPage({ searchParams }: AdminOrganizationsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const { items: organizations, page, totalPages } = await getAdminOrganizations(
    {
      q: filters?.q,
      status: filters?.status
    },
    pagination
  );

  const hasActiveFilters = Boolean(filters?.q || filters?.status);

  return (
    <AdminShell title="Organizations" description="Review organizer requests and manage organization approval status.">
      <FilterBar action="/admin/organizations" searchPlaceholder="Search organization, email, wilaya">
        <SelectFilter
          name="status"
          label="All statuses"
          defaultValue={filters?.status}
          options={[
            { value: "PENDING", label: "Pending" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "SUSPENDED", label: "Suspended" }
          ]}
        />
      </FilterBar>

      {organizations.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No organizations found"
          description={hasActiveFilters ? "No organizations match the current filters. Try clearing them to review the full list." : "Organizer requests will appear here for review and approval."}
          action={hasActiveFilters ? (
            <ButtonLink href="/admin/organizations" size="sm" variant="outline">
              Reset filters
            </ButtonLink>
          ) : undefined}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
          {organizations.map((organization) => {
            const owner = organization.members[0]?.user;

            return (
              <article key={organization.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={organization.status} />
                      <span className="text-xs font-semibold text-gray-500">Created {formatDate(organization.createdAt)}</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-teal-50 text-brand-teal">
                        {organization.logoUrl ? (
                          <Image src={organization.logoUrl} alt="" fill sizes="44px" className="object-cover" />
                        ) : (
                          <Building2 className="size-5" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words text-lg font-black text-gray-950">{organization.name}</h2>
                        <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-gray-600">
                          {organization.description ?? "No description provided yet."}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                      <p className="flex min-w-0 items-center gap-2">
                        <Mail className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                        <span className="break-all">{organization.email ?? "No email"}</span>
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <Phone className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                        <span className="break-all">{organization.phone ?? "No phone"}</span>
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                        <span className="break-words">{[organization.city, organization.wilaya].filter(Boolean).join(", ") || "No location"}</span>
                      </p>
                      <p className="flex min-w-0 items-center gap-2">
                        <UserRound className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                        <span className="break-words">{owner ? `${owner.firstName} ${owner.lastName}` : "No owner"}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1">
                        <Users className="size-3.5" aria-hidden="true" />
                        {organization._count.members} members
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1">
                        {organization._count.races} races
                      </span>
                    </div>
                    {organization.rejectionReason ? (
                      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                        <p className="font-bold">Rejection reason</p>
                        <p className="mt-1 leading-6">{organization.rejectionReason}</p>
                      </div>
                    ) : null}
                  </div>

                  {organization.status === "PENDING" ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:w-72">
                      <p className="text-xs font-bold uppercase tracking-normal text-gray-500">Review actions</p>
                      <form action={approveOrganizationAction}>
                        <input type="hidden" name="id" value={organization.id} />
                        <Button type="submit" variant="secondary" size="md" className="w-full">
                          Approve organization
                        </Button>
                      </form>
                      <form action={rejectOrganizationAction} className="grid gap-2 border-t border-gray-200 pt-3">
                        <input type="hidden" name="id" value={organization.id} />
                        <label className="grid gap-1 text-xs font-bold text-gray-700">
                          Rejection reason
                          <textarea
                            name="reason"
                            rows={3}
                            placeholder="Missing documents, invalid contact, duplicate organization..."
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
                          />
                        </label>
                        <Button type="submit" variant="ghost" size="md" className="w-full text-red-700 hover:bg-red-50">
                          Reject
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          <Pagination basePath="/admin/organizations" searchParams={filters} page={page} totalPages={totalPages} />
        </div>
        </div>
      )}
    </AdminShell>
  );
}
