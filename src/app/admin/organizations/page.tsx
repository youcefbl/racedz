import { Building2, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getAdminOrganizations, requireAdmin } from "@/lib/admin";
import { approveOrganizationAction, rejectOrganizationAction } from "../actions";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminOrganizationsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function AdminOrganizationsPage({ searchParams }: AdminOrganizationsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const organizations = await getAdminOrganizations({
    q: filters?.q,
    status: filters?.status
  });

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
        <EmptyState title="No organizations found" description="There are no organizations matching the current filters." />
      ) : (
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
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                        <Building2 className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-gray-950">{organization.name}</h2>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
                          {organization.description ?? "No description provided yet."}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                      <p className="flex items-center gap-2">
                        <Mail className="size-4 text-brand-teal" aria-hidden="true" />
                        {organization.email ?? "No email"}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="size-4 text-brand-teal" aria-hidden="true" />
                        {organization.phone ?? "No phone"}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
                        {[organization.city, organization.wilaya].filter(Boolean).join(", ") || "No location"}
                      </p>
                      <p className="flex items-center gap-2">
                        <UserRound className="size-4 text-brand-teal" aria-hidden="true" />
                        {owner ? `${owner.firstName} ${owner.lastName}` : "No owner"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs font-semibold text-gray-500">
                      <span>{organization._count.members} members</span>
                      <span>{organization._count.races} races</span>
                    </div>
                  </div>

                  {organization.status === "PENDING" ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:w-40 lg:grid-cols-1">
                      <form action={approveOrganizationAction}>
                        <input type="hidden" name="id" value={organization.id} />
                        <Button type="submit" variant="secondary" size="sm" className="w-full">
                          Approve
                        </Button>
                      </form>
                      <form action={rejectOrganizationAction}>
                        <input type="hidden" name="id" value={organization.id} />
                        <Button type="submit" variant="outline" size="sm" className="w-full">
                          Reject
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
