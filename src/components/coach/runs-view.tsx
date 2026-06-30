"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CoachRunsPanel } from "@/components/coach/coach-runs-panel";
import { getCoachCopy } from "@/components/coach/copy";
import type { CoachLocale, CoachRun } from "@/components/coach/types";
import { withLocale } from "@/lib/i18n";

// Standalone "Runs" tab: record a run and browse past runs. Reuses CoachRunsPanel
// (recorder + list + route map); "Analyze" hands off to the AI coach.
export function RunsView({ initialRuns, locale }: { initialRuns: CoachRun[]; locale: CoachLocale }) {
  const router = useRouter();
  const copy = getCoachCopy(locale);
  const [runs, setRuns] = useState<CoachRun[]>(initialRuns);
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <CoachRunsPanel
        runs={runs}
        plan={null}
        locale={locale}
        copy={copy}
        pendingAction={pendingAction}
        onSaved={async () => {
          await refresh();
        }}
        onAnalyze={async (runId) => {
          setPendingAction(runId);
          router.push(withLocale("/account/coach", locale));
        }}
      />
    </div>
  );
}
