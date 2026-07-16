"use client";

import { Check, CheckCircle2 } from "lucide-react";
import type { CoachCopy } from "@/components/coach/copy";
import { Button } from "@/components/ui/button";

// How the just-logged run linked to the plan, awaiting the runner's confirm/undo (Phase 1.3):
// - "auto": the matcher linked it confidently; show a confirmation with an undo ("not this workout").
// - "suggest": a medium-confidence match; ask the runner to confirm before linking.
export type MatchPrompt = { kind: "auto" | "suggest"; runId: string; workoutId: string; title: string | null };

export function MatchConfirmBanner({
  prompt,
  saving,
  copy,
  onConfirm,
  onFreeRun
}: {
  prompt: MatchPrompt;
  saving: boolean;
  copy: CoachCopy;
  onConfirm: () => void;
  onFreeRun: () => void;
}) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
      {prompt.kind === "auto" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm font-black text-gray-950">
            <CheckCircle2 className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
            {copy.matchAutoLinked.replace("{title}", prompt.title ?? "")}
          </p>
          <button
            type="button"
            onClick={onFreeRun}
            disabled={saving}
            className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-black text-gray-600 underline decoration-gray-300 underline-offset-2 transition hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50"
          >
            {copy.matchNotThisWorkout}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black text-gray-950">{copy.matchSuggestQuestion.replace("{title}", prompt.title ?? "")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onConfirm} disabled={saving}>
              <Check className="size-4" aria-hidden="true" />
              {copy.matchConfirmYes}
            </Button>
            <button
              type="button"
              onClick={onFreeRun}
              disabled={saving}
              className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-black text-gray-600 transition hover:bg-white hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50"
            >
              {copy.matchFreeRun}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
