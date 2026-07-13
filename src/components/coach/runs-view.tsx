"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { coachRequest } from "@/components/coach/api";
import { CoachRunsPanel } from "@/components/coach/coach-runs-panel";
import { getCoachCopy } from "@/components/coach/copy";
import { BadgesStrip } from "@/components/coach/badges-strip";
import { GpxImport } from "@/components/coach/gpx-import";
import { RecordsSummary, type RecordsSummary as RecordsSummaryData } from "@/components/coach/records-summary";
import type { GuidedWorkout } from "@/components/coach/run-recorder";
import type { CoachLocale, CoachRun } from "@/components/coach/types";
import type { Badge } from "@/lib/coach/badges";
import { withLocale } from "@/lib/i18n";

// Standalone "Runs" tab (bottom-nav on the phone app): record a run and browse past runs.
// Reuses CoachRunsPanel (recorder + list + route map). Since analysis is shown by the AI
// coach on a separate screen, "Analyze"/"Coach analysis" hand off to /account/coach and
// focus the relevant answer via the `focus` query param.
export function RunsView({
  initialRuns,
  analyzedRuns: initialAnalyzedRuns = {},
  weightKg = null,
  records = null,
  badges = [],
  guidedWorkout = null,
  locale
}: {
  initialRuns: CoachRun[];
  analyzedRuns?: Record<string, string>;
  weightKg?: number | null;
  records?: RecordsSummaryData | null;
  badges?: Badge[];
  guidedWorkout?: GuidedWorkout | null;
  locale: CoachLocale;
}) {
  const router = useRouter();
  const copy = getCoachCopy(locale);
  const [runs, setRuns] = useState<CoachRun[]>(initialRuns);
  const [analyzedRuns, setAnalyzedRuns] = useState<Record<string, string>>(initialAnalyzedRuns);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/runs", { headers: { accept: "application/json" } });
      const json = (await res.json().catch(() => null)) as { data?: CoachRun[] } | null;
      if (json?.data) setRuns(json.data);
    } catch {
      /* keep the current list */
    }
  }, []);

  // Land on the coach screen and scroll straight to the given answer.
  const openAnalysis = useCallback(
    (interactionId: string) => {
      router.push(withLocale(`/account/coach?focus=${interactionId}`, locale));
    },
    [router, locale]
  );

  // Generate the run's analysis here (so it counts against the AI quota exactly like the
  // coach tab), then hand off to the coach screen focused on the fresh answer.
  const analyze = useCallback(
    async (runId: string) => {
      setPendingAction("POST_RUN");
      try {
        const created = await coachRequest<{ data: { id: string } }>("/api/coach/interactions", {
          method: "POST",
          body: JSON.stringify({ type: "POST_RUN", runId, message: null })
        });
        setAnalyzedRuns((prev) => ({ ...prev, [runId]: created.data.id }));
        openAnalysis(created.data.id);
      } finally {
        setPendingAction(null);
      }
    },
    [openAnalysis]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {records ? <RecordsSummary records={records} locale={locale} /> : null}
      {badges.length > 0 ? <BadgesStrip badges={badges} locale={locale} /> : null}
      <GpxImport
        locale={locale}
        onImported={async () => {
          await refresh();
          router.refresh();
        }}
      />
      <CoachRunsPanel
        runs={runs}
        plan={null}
        locale={locale}
        copy={copy}
        pendingAction={pendingAction}
        weightKg={weightKg}
        guidedWorkout={guidedWorkout}
        analyzedRuns={analyzedRuns}
        onViewAnalysis={openAnalysis}
        onSaved={async (_runId, analyzeNow) => {
          await refresh();
          if (analyzeNow && _runId) await analyze(_runId);
        }}
        onAnalyze={analyze}
      />
    </div>
  );
}
