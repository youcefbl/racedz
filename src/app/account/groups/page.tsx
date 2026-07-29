import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GroupsListView } from "@/components/groups/groups-list-view";
import { getUserGroups, listDiscoverableGroups } from "@/lib/groups";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Groups"
};

export default async function GroupsPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/groups");

  const locale = getLocale((await searchParams)?.lang);
  const [groups, discoverGroups] = await Promise.all([
    getUserGroups(session.user.id),
    listDiscoverableGroups(session.user.id)
  ]);

  return <GroupsListView groups={groups} discoverGroups={discoverGroups} locale={locale} />;
}
