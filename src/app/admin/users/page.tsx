import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Mail, MapPin, Phone, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/format";
import { getAdminUsers, requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";
import { updateUserRoleAction } from "../actions";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    page?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const { items: users, page, totalPages } = await getAdminUsers(
    {
      q: filters?.q,
      role: filters?.role
    },
    pagination
  );

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
        <EmptyState
          icon={UsersRound}
          title="No users found"
          description="Adjust the filters or search query to find matching users."
        />
      ) : (
        <>
          {/* Mobile: stacked cards (the 7-column table is unreadable at phone widths). */}
          <div className="grid gap-3 md:hidden">
            {users.map((user) => {
              const canManage =
                user.id !== session.user.id &&
                !(user.role === "SUPERADMIN" && session.user.role !== "SUPERADMIN");
              return (
                <div key={user.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/admin/users/${user.id}`} className="group flex min-w-0 items-center gap-3">
                      <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-teal-50 text-brand-teal">
                        {user.avatarUrl ? (
                          <Image
                            src={user.avatarUrl}
                            alt={`${user.firstName} ${user.lastName}`}
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : (
                          <UserRound className="size-5" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-gray-950 group-hover:text-brand-teal">
                          {user.firstName} {user.lastName}
                        </p>
                        {user.arabicFullName ? (
                          <p className="truncate text-xs text-gray-500">{user.arabicFullName}</p>
                        ) : null}
                      </div>
                    </Link>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <StatusBadge value={user.role} />
                      {!user.emailVerifiedAt ? <Badge variant="default">Unverified</Badge> : null}
                      {user.blockedAt ? <Badge variant="red">Blocked</Badge> : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <Mail className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                      <span className="min-w-0 break-words">{user.email}</span>
                    </p>
                    {user.phone ? (
                      <p className="flex items-center gap-2">
                        <Phone className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                        {user.phone}
                      </p>
                    ) : null}
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                      {[user.city, user.wilaya].filter(Boolean).join(", ") || "Not set"}
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                      Joined {formatDate(user.createdAt)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{user._count.registrations} registrations</span>
                    <span>{user._count.organizations} organizations</span>
                  </div>

                  <form action={updateUserRoleAction} className="mt-4 flex items-end gap-2">
                    <input type="hidden" name="id" value={user.id} />
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block text-xs font-semibold text-gray-500">Manage role</span>
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={!canManage}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="RUNNER">Runner</option>
                        <option value="ORGANIZER">Organizer</option>
                        <option value="ADMIN">Admin</option>
                        {session.user.role === "SUPERADMIN" || user.role === "SUPERADMIN" ? (
                          <option value="SUPERADMIN">Superadmin</option>
                        ) : null}
                      </select>
                    </label>
                    <Button type="submit" variant="secondary" size="md" disabled={!canManage} className="shrink-0">
                      Save
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>

          {/* Desktop: full table with horizontal scroll fallback. */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-normal text-gray-500">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Manage role</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => {
                    const canManage =
                      user.id !== session.user.id &&
                      !(user.role === "SUPERADMIN" && session.user.role !== "SUPERADMIN");
                    return (
                      <tr key={user.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <Link href={`/admin/users/${user.id}`} className="group flex items-center gap-3">
                            <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-teal-50 text-brand-teal">
                              {user.avatarUrl ? (
                                <Image
                                  src={user.avatarUrl}
                                  alt={`${user.firstName} ${user.lastName}`}
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              ) : (
                                <UserRound className="size-5" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-950 group-hover:text-brand-teal">
                                {user.firstName} {user.lastName}
                              </p>
                              {user.arabicFullName ? (
                                <p className="text-xs text-gray-500">{user.arabicFullName}</p>
                              ) : null}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <StatusBadge value={user.role} />
                      {!user.emailVerifiedAt ? <Badge variant="default">Unverified</Badge> : null}
                      {user.blockedAt ? <Badge variant="red">Blocked</Badge> : null}
                    </div>
                        </td>
                        <td className="px-4 py-4">
                          <form action={updateUserRoleAction} className="flex min-w-52 items-center gap-2">
                            <input type="hidden" name="id" value={user.id} />
                            <label className="min-w-0 flex-1">
                              <span className="sr-only">Role for {user.email}</span>
                              <select
                                name="role"
                                defaultValue={user.role}
                                disabled={!canManage}
                                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="RUNNER">Runner</option>
                                <option value="ORGANIZER">Organizer</option>
                                <option value="ADMIN">Admin</option>
                                {session.user.role === "SUPERADMIN" || user.role === "SUPERADMIN" ? (
                                  <option value="SUPERADMIN">Superadmin</option>
                                ) : null}
                              </select>
                            </label>
                            <Button type="submit" variant="secondary" size="sm" disabled={!canManage} className="shrink-0">
                              Save
                            </Button>
                          </form>
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          <p className="flex items-center gap-2">
                            <Mail className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                            {user.email}
                          </p>
                          {user.phone ? (
                            <p className="mt-1 flex items-center gap-2">
                              <Phone className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                              {user.phone}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          <p className="flex items-center gap-2">
                            <MapPin className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                            {[user.city, user.wilaya].filter(Boolean).join(", ") || "Not set"}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          <p>{user._count.registrations} registrations</p>
                          <p>{user._count.organizations} organizations</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">{formatDate(user.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Pagination basePath="/admin/users" searchParams={filters} page={page} totalPages={totalPages} />
    </AdminShell>
  );
}
