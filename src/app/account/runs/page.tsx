import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RunsView } from "@/components/coach/runs-view";
import type { RecordsSummary } from "@/components/coach/records-summary";
import type { CoachRun } from "@/components/coach/types";
import { getRunsScreenData } from "@/lib/coach/service";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Runs"
};

export default async function RunsPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/runs");

  const locale = getLocale((await searchParams)?.lang);
  const { runs, analyzedRuns, weightKg, records, todayWorkout, badges, recentPaceSecondsPerKm } = await getRunsScreenData(session.user.id, 50);
  const initialRuns = JSON.parse(JSON.stringify(runs)) as CoachRun[];
  const recordsData = JSON.parse(JSON.stringify(records)) as RecordsSummary;

  return (
    <RunsView
      initialRuns={initialRuns}
      analyzedRuns={analyzedRuns}
      weightKg={weightKg}
      records={recordsData}
      badges={badges}
      guidedWorkout={todayWorkout}
      recentPaceSecondsPerKm={recentPaceSecondsPerKm}
      locale={locale}
    />
  );
}
