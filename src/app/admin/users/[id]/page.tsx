import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDateTime, formatDzd } from "@/lib/format";
import { getAdminUserById, requireAdmin } from "@/lib/admin";
import { AdminShell, EmptyState, StatusBadge } from "../../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  await requireAdmin();
  const { id } = await params;
  const user = await getAdminUserById(id);

  if (!user) {
    notFound();
  }

  return (
    <AdminShell
      eyebrow="User profile"
      title={`${user.firstName} ${user.lastName}`}
      description={user.email}
      action={
        <ButtonLink href="/admin/users" variant="outline" size="sm">
          Back to users
        </ButtonLink>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-brand-teal">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={`${user.firstName} ${user.lastName}`}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <UserRound className="size-12" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-950">
                {user.firstName} {user.lastName}
              </h2>
              {user.arabicFullName ? <p className="text-sm text-gray-500">{user.arabicFullName}</p> : null}
              <div className="mt-2 flex justify-center">
                <StatusBadge value={user.role} />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-center gap-2 text-gray-600">
              <Mail className="size-4 text-brand-teal" aria-hidden="true" />
              {user.email}
            </p>
            {user.phone ? (
              <p className="flex items-center gap-2 text-gray-600">
                <Phone className="size-4 text-brand-teal" aria-hidden="true" />
                {user.phone}
              </p>
            ) : null}
            <p className="flex items-center gap-2 text-gray-600">
              <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
              {[user.city, user.wilaya].filter(Boolean).join(", ") || "Not set"}
            </p>
            {user.dateOfBirth ? (
              <p className="flex items-center gap-2 text-gray-600">
                <CalendarDays className="size-4 text-brand-teal" aria-hidden="true" />
                Born {formatDate(user.dateOfBirth)}
              </p>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat label="Registrations" value={user._count.registrations} />
            <Stat label="Organizations" value={user._count.organizations} />
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <p>Joined {formatDate(user.createdAt)}</p>
            {user.nationalId ? <p className="mt-1">ID: {user.nationalId}</p> : null}
            {user.gender ? <p className="mt-1">Gender: {user.gender}</p> : null}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-gray-950">Registrations</h2>
            {user.registrations.length === 0 ? (
              <EmptyState
                title="No registrations"
                description="This user has not registered for any races yet."
              />
            ) : (
              <div className="grid gap-3">
                {user.registrations.map((registration) => (
                  <article
                    key={registration.id}
                    className="rounded-lg border border-gray-200 p-4 transition hover:border-brand-teal"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link
                          href={`/races/${registration.raceEvent.slug}`}
                          className="font-bold text-gray-950 hover:text-brand-teal"
                        >
                          {registration.raceEvent.title}
                        </Link>
                        <p className="mt-1 text-sm text-gray-500">
                          {registration.raceCategory.name} · {registration.raceCategory.distanceKm}K ·{" "}
                          {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Submitted {formatDateTime(registration.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={registration.status} />
                        <Badge variant={getPaymentVariant(registration.paymentStatus)}>
                          {registration.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-gray-950">Organizations</h2>
            {user.organizations.length === 0 ? (
              <EmptyState
                title="No organizations"
                description="This user is not a member of any organization."
              />
            ) : (
              <div className="grid gap-3">
                {user.organizations.map((membership) => (
                  <article
                    key={membership.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                  >
                    <div>
                      <p className="font-bold text-gray-950">{membership.organization.name}</p>
                      <p className="text-xs text-gray-500">Joined {formatDate(membership.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={membership.role} />
                      <StatusBadge value={membership.organization.status} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <p className="text-2xl font-black text-gray-950">{value}</p>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
    </div>
  );
}

function getPaymentVariant(status: string) {
  switch (status) {
    case "PAID":
    case "NOT_REQUIRED":
      return "green";
    case "PENDING":
    case "MANUAL_REVIEW":
      return "orange";
    case "FAILED":
    case "REFUNDED":
      return "red";
    default:
      return "default";
  }
}
