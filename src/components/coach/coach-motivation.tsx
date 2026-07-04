"use client";

import { Flame, Lightbulb, RefreshCw, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import type { CoachCopy } from "@/components/coach/copy";
import type { CoachGoal, CoachMetrics, CoachRun } from "@/components/coach/types";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export function CoachMotivation({
  goal,
  runs,
  metrics,
  tips,
  copy
}: {
  goal: CoachGoal;
  runs: CoachRun[];
  metrics: CoachMetrics;
  tips?: string[];
  copy: CoachCopy;
}) {
  const runTarget = Math.max(2, goal.availableTrainingDays.length);
  const distanceTarget = Math.max(1, Math.round(goal.currentWeeklyDistanceKm));
  const runsThisWeek = metrics.runCountLast7Days;
  const distanceThisWeek = metrics.distanceLast7DaysKm;
  const streak = weekStreak(runs);

  return (
    <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-brand-orange" aria-hidden="true" />
            <h2 className="text-base font-black text-gray-950">{copy.challengeTitle}</h2>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black",
              streak > 0 ? "bg-orange-50 text-brand-orange" : "bg-gray-100 text-gray-600"
            )}
          >
            <Flame className="size-3.5" aria-hidden="true" />
            {streak} {copy.streakLabel}
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ChallengeBar label={copy.challengeRuns} value={runsThisWeek} target={runTarget} display={`${runsThisWeek} / ${runTarget}`} />
          <ChallengeBar
            label={copy.challengeDistance}
            value={distanceThisWeek}
            target={distanceTarget}
            display={`${distanceThisWeek.toFixed(1)} / ${distanceTarget} km`}
          />
        </div>

        <p className="mt-4 text-xs font-semibold text-gray-500">{streak > 0 ? copy.streakActive : copy.streakNone}</p>
      </section>

      <CoachTip tips={tips} copy={copy} />
    </div>
  );
}

function ChallengeBar({ label, value, target, display }: { label: string; value: number; target: number; display: string }) {
  const percent = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
  const complete = value >= target;
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-xs font-bold uppercase text-gray-500">{label}</span>
        <span className={cn("text-sm font-black tabular-nums", complete ? "text-green-600" : "text-gray-950")}>{display}</span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full transition-all", complete ? "bg-green-500" : "bg-brand-orange")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CoachTip({ tips, copy }: { tips?: string[]; copy: CoachCopy }) {
  // Prefer DB-backed tips (matched to the runner's profile); fall back to the built-in
  // copy tips when none are published yet so the card is never empty.
  const list = tips && tips.length > 0 ? tips : copy.tips;
  // Start deterministically (0) so SSR and first client render match — no hydration
  // mismatch — then pick a random starting tip after mount. The runner cycles from there.
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(Math.floor(Math.random() * list.length));
  }, [list.length]);
  const tip = list[index % list.length];

  return (
    <section className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-5 text-brand-teal" aria-hidden="true" />
        <h2 className="text-base font-black text-gray-950">{copy.tipTitle}</h2>
      </div>
      <p className="mt-3 flex-1 text-sm leading-6 text-gray-700">{tip}</p>
      <button
        type="button"
        onClick={() => setIndex((current) => (current + 1) % list.length)}
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 self-start rounded-md border border-gray-300 px-3 py-1.5 text-xs font-black text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        {copy.newTip}
      </button>
    </section>
  );
}

// Consecutive 7-day windows (ending today) that each contain at least one run.
function weekStreak(runs: CoachRun[], now = Date.now()) {
  const times = runs
    .map((run) => new Date(run.startedAt).getTime())
    .filter((time) => Number.isFinite(time) && time <= now);
  if (times.length === 0) return 0;

  let streak = 0;
  for (let week = 0; week < 52; week += 1) {
    const end = now - week * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    if (times.some((time) => time > start && time <= end)) streak += 1;
    else break;
  }
  return streak;
}
