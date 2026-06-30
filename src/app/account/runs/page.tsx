import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RunsView } from "@/components/coach/runs-view";
import type { CoachRun } from "@/components/coach/types";
import { getRunnerRuns } from "@/lib/coach/service";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Runs"
};

export default async function RunsPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/runs");

  const locale = getLocale((await searchParams)?.lang);
  const runs = await getRunnerRuns(session.user.id, 50);
  const initialRuns = JSON.parse(JSON.stringify(runs)) as CoachRun[];

  return <RunsView initialRuns={initialRuns} locale={locale} />;
}
