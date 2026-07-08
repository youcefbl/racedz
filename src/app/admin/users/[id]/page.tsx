import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Ban, CalendarDays, Mail, MapPin, Phone, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { formatDate, formatDateTime, formatDzd } from "@/lib/format";
import { getAdminUserById, requireAdmin } from "@/lib/admin";
import { deleteUserAction, toggleBlockUserAction, verifyUserAction } from "../../actions";
import { AdminShell, EmptyState, StatusBadge } from "../../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminUserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const session = await requireAdmin();
  const { id } = await params;
  const user = await getAdminUserById(id);

  if (!user) {
    notFound();
  }

  const isSelf = session.user.id === user.id;
  const canManageSuperadmin = session.user.role === "SUPERADMIN";
  const canManage = !isSelf && (user.role !== "SUPERADMIN" || canManageSuperadmin);
  const canDelete = canManage && user.role !== "SUPERADMIN";

  return (
    <AdminShell
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
            <div className="min-w-0 max-w-full">
              <h2 className="break-words text-xl font-black text-gray-950">
                {user.firstName} {user.lastName}
              </h2>
              {user.arabicFullName ? <p className="break-words text-sm text-gray-500">{user.arabicFullName}</p> : null}
              <div className="mt-2 flex justify-center">
                <StatusBadge value={user.role} />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-start gap-2 text-gray-600">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              <span className="min-w-0 break-words">{user.email}</span>
            </p>
            {user.phone ? (
              <p className="flex items-start gap-2 text-gray-600">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                <span className="min-w-0 break-words">{user.phone}</span>
              </p>
            ) : null}
            <p className="flex items-start gap-2 text-gray-600">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              <span className="min-w-0 break-words">{[user.city, user.wilaya].filter(Boolean).join(", ") || "Not set"}</span>
            </p>
            {user.dateOfBirth ? (
              <p className="flex items-start gap-2 text-gray-600">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                <span className="min-w-0 break-words">Born {formatDate(user.dateOfBirth)}</span>
              </p>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat label="Registrations" value={user._count.registrations} />
            <Stat label="Organizations" value={user._count.organizations} />
            <Stat label="Runs recorded" value={user._count.runnerRuns} />
            <Stat label="AI coach prompts" value={user._count.coachInteractions} />
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <p>Joined {formatDate(user.createdAt)}</p>
            {user.nationalId ? <p className="mt-1">ID: {user.nationalId}</p> : null}
            {user.gender ? <p className="mt-1">Gender: {user.gender}</p> : null}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-gray-950">Account management</h2>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Email status</p>
                <div className="mt-1">
                  {user.emailVerifiedAt ? <Badge variant="green">Verified</Badge> : <Badge variant="default">Unverified</Badge>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Account status</p>
                <div className="mt-1">
                  {user.blockedAt ? <Badge variant="red">Blocked</Badge> : <Badge variant="green">Active</Badge>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">First login</p>
                <p className="mt-1 text-gray-700">{user.firstLoginAt ? formatDateTime(user.firstLoginAt) : "Never"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Last login</p>
                <p className="mt-1 text-gray-700">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</p>
              </div>
            </div>
            {canManage ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                {!user.emailVerifiedAt ? (
                  <form action={verifyUserAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <Button type="submit" variant="outline" size="sm">
                      <BadgeCheck className="size-4" aria-hidden="true" />
                      Verify email
                    </Button>
                  </form>
                ) : null}
                <form action={toggleBlockUserAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <ConfirmSubmit
                    variant={user.blockedAt ? "outline" : "ghost"}
                    size="sm"
                    className={user.blockedAt ? undefined : "text-red-700 hover:bg-red-50"}
                    title={user.blockedAt ? "Unblock this account?" : "Block this account?"}
                    description={
                      user.blockedAt
                        ? "They will be able to sign in again."
                        : "They will be signed out and unable to sign in until unblocked."
                    }
                    confirmLabel={user.blockedAt ? "Unblock" : "Block"}
                    cancelLabel="Cancel"
                  >
                    <Ban className="size-4" aria-hidden="true" />
                    {user.blockedAt ? "Unblock" : "Block"}
                  </ConfirmSubmit>
                </form>
                {canDelete ? (
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <ConfirmSubmit
                      variant="danger"
                      size="sm"
                      title="Delete this account?"
                      description="This permanently removes the account and its data. This cannot be undone."
                      confirmLabel="Delete account"
                      cancelLabel="Keep it"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </ConfirmSubmit>
                  </form>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-gray-950">Coaching target</h2>
            {user.runnerGoals.length === 0 ? (
              <EmptyState
                title="No active goal"
                description="This user has not set up an AI coaching goal yet."
              />
            ) : (
              (() => {
                const goal = user.runnerGoals[0];
                return (
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Goal</p>
                      <p className="mt-1 font-bold text-gray-900">{formatGoalType(goal.goalType, goal.customGoal)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Target date</p>
                      <p className="mt-1 text-gray-700">{formatDate(goal.targetDate)}</p>
                    </div>
                    {goal.targetDistanceKm ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Target distance</p>
                        <p className="mt-1 text-gray-700">{goal.targetDistanceKm} km</p>
                      </div>
                    ) : null}
                    {goal.targetTimeSeconds ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Target time</p>
                        <p className="mt-1 text-gray-700">{formatDuration(goal.targetTimeSeconds)}</p>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">Experience</p>
                      <p className="mt-1 text-gray-700">{titleCase(goal.experienceLevel)}</p>
                    </div>
                  </div>
                );
              })()
            )}
          </section>

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
                      <div className="min-w-0">
                        <Link
                          href={`/races/${registration.raceEvent.slug}`}
                          className="break-words font-bold text-gray-950 hover:text-brand-teal"
                        >
                          {registration.raceEvent.title}
                        </Link>
                        <p className="mt-1 break-words text-sm text-gray-500">
                          {registration.raceCategory.name} · {registration.raceCategory.distanceKm}K ·{" "}
                          {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Submitted {formatDateTime(registration.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
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
                    className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-bold text-gray-950">{membership.organization.name}</p>
                      <p className="text-xs text-gray-500">Joined {formatDate(membership.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
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

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatGoalType(goalType: string, customGoal: string | null) {
  if (goalType === "OTHER" && customGoal) {
    return customGoal;
  }
  return titleCase(goalType);
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0")];
  return hours > 0 ? `${hours}:${parts.join(":")}` : parts.join(":");
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
