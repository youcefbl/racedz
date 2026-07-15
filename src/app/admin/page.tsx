import { Building2, CalendarDays, ClipboardList, TimerReset, Trophy, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getAdminDashboardStats, requireAdmin } from "@/lib/admin";
import { AdminShell, StatCard } from "./_components/admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const stats = await getAdminDashboardStats();

  return (
    <AdminShell
      title="ZidRun operations"
      description="Monitor platform activity, review pending work, and jump into the admin queues without loading entire tables."
      action={
        <ButtonLink href="/admin/races" size="lg">
          <Trophy className="size-5" aria-hidden="true" />
          Review races
        </ButtonLink>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers} icon={UsersRound} />
        <StatCard label="Organizations" value={stats.totalOrganizations} icon={Building2} />
        <StatCard label="Total races" value={stats.totalRaces} icon={Trophy} />
        <StatCard label="All registrations" value={stats.allTimeRegistrations} icon={ClipboardList} />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Races created today" value={stats.racesCreatedToday} icon={CalendarDays} tone="orange" />
        <StatCard label="Races created this week" value={stats.racesCreatedThisWeek} icon={TimerReset} tone="orange" />
        <StatCard label="Races created this year" value={stats.racesCreatedThisYear} icon={CalendarDays} tone="orange" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <QueueCard
          title="Organization approvals"
          value={stats.pendingOrganizations}
          href="/admin/organizations?status=PENDING"
          description="Review new organizer requests and upgrade approved owners."
        />
        <QueueCard
          title="Race approvals"
          value={stats.pendingRaces}
          href="/admin/races?status=PENDING_REVIEW"
          description="Publish only reviewed organization-created races."
        />
        <QueueCard
          title="Manual payment reviews"
          value={stats.manualReviewPayments}
          href="/admin/registrations?paymentStatus=MANUAL_REVIEW"
          description="Check registration payments that need manual review."
        />
      </section>
    </AdminShell>
  );
}

function QueueCard({
  title,
  value,
  description,
  href
}: {
  title: string;
  value: number;
  description: string;
  href: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
        </div>
        {/* min-w-12 + px-2 instead of a fixed size-12 box: a 4-digit queue count overflowed the
            square. orangeText because brand-orange on orange-50 is 2.59:1 — under even the 3:1
            large-text bar. */}
        <div className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-lg bg-orange-50 px-2 text-2xl font-black tabular-nums text-brand-orangeText">
          {value}
        </div>
      </div>
      <ButtonLink href={href} variant="outline" size="sm" className="mt-4">
        Open queue
      </ButtonLink>
    </div>
  );
}
