import { Mail, MapPin, Phone, UserRound } from "lucide-react";
import { formatDate } from "@/lib/format";
import { getAdminUsers, requireAdmin } from "@/lib/admin";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const users = await getAdminUsers({
    q: filters?.q,
    role: filters?.role
  });

  return (
    <AdminShell title="Users" description="Search users, inspect role assignments, and see account activity at a glance.">
      <FilterBar action="/admin/users" searchPlaceholder="Search name, email, phone, wilaya">
        <SelectFilter
          name="role"
          label="All roles"
          defaultValue={filters?.role}
          options={[
            { value: "RUNNER", label: "Runner" },
            { value: "ORGANIZER", label: "Organizer" },
            { value: "ADMIN", label: "Admin" },
            { value: "SUPERADMIN", label: "Superadmin" }
          ]}
        />
      </FilterBar>

      {users.length === 0 ? (
        <EmptyState title="No users found" description="Adjust the filters or search query to find matching users." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-normal text-gray-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                          <UserRound className="size-5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-950">
                            {user.firstName} {user.lastName}
                          </p>
                          {user.arabicFullName ? <p className="text-xs text-gray-500">{user.arabicFullName}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge value={user.role} />
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      <p className="flex items-center gap-2">
                        <Mail className="size-4 text-brand-teal" aria-hidden="true" />
                        {user.email}
                      </p>
                      {user.phone ? (
                        <p className="mt-1 flex items-center gap-2">
                          <Phone className="size-4 text-brand-teal" aria-hidden="true" />
                          {user.phone}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      <p className="flex items-center gap-2">
                        <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
                        {[user.city, user.wilaya].filter(Boolean).join(", ") || "Not set"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      <p>{user._count.registrations} registrations</p>
                      <p>{user._count.organizations} organizations</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{formatDate(user.createdAt)}</td>
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
