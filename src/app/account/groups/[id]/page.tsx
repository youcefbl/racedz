import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { GroupDetailView } from "@/components/groups/group-detail-view";
import { getGroupDetail, getGroupFeed } from "@/lib/groups";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Group"
};

export default async function GroupDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/groups");

  const { id } = await params;
  const query = await searchParams;
  const locale = getLocale(query?.lang);

  const detail = await getGroupDetail(session.user.id, id);
  if (!detail) notFound();

  const feed = await getGroupFeed(session.user.id, id);

  return <GroupDetailView group={detail} feed={feed} locale={locale} actionError={query?.error ?? null} />;
}
