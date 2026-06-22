import { CalendarPlus, Download, UsersRound, Trophy, Clock3 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getOrganizerDashboardData } from "@/lib/organizer";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getLocale, withLocale } from "@/lib/i18n";
import { translateOrganizer, translateOrganizerEnum } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

export default async function OrganizerPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const locale = getLocale((await searchParams)?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/organizer");
  }

  const dashboard = await getOrganizerDashboardData(session.user.id);

  if (!dashboard) {
    redirect(withLocale("/organizer/request", locale));
  }

  const stats = [
    { label: t("Published events"), value: dashboard.stats.publishedRaces, icon: Trophy },
    { label: t("Pending review"), value: dashboard.stats.pendingRaces, icon: Clock3 },
    { label: t("Registrations"), value: dashboard.stats.registrations, icon: UsersRound },
    { label: t("Manual reviews"), value: dashboard.stats.manualReviews, icon: Download }
  ];

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer dashboard")}</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{dashboard.organization.name}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {translateOrganizerEnum(locale, dashboard.membership.role)} · {dashboard.organization._count.members} {t("Members")} · {dashboard.stats.invitations} {t("Invitations")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={withLocale("/organizer/members", locale)} variant="outline" size="lg">
              <UsersRound className="size-5" aria-hidden="true" />
              {t("Members")}
            </ButtonLink>
            <ButtonLink href={withLocale("/organizer/events/new", locale)} size="lg">
              <CalendarPlus className="size-5" aria-hidden="true" />
              {t("Create Event")}
            </ButtonLink>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <stat.icon className="mb-3 size-5 text-brand-orange" aria-hidden="true" />
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-black text-gray-950">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-gray-950">{t("Next organizer tasks")}</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-600">
            <p>{t("Create events with one starter category, then wait for admin publication approval.")}</p>
            <p>{t("Invite trusted teammates from the members screen. Pending invitations do not grant access yet.")}</p>
            <p>{t("Review participant lists and CSV exports from each event once registrations arrive.")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
