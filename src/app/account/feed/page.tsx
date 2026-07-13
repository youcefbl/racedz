import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FeedView } from "@/components/social/feed-view";
import { getFeed } from "@/lib/social";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed"
};

export default async function FeedPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/feed");

  const locale = getLocale((await searchParams)?.lang);
  const { runs, nextCursor } = await getFeed(session.user.id, { limit: 20 });

  return <FeedView initialRuns={runs} initialCursor={nextCursor} locale={locale} />;
}
