"use client";

import { Capacitor } from "@capacitor/core";
import { Activity, ArrowRight, BrainCircuit, CalendarRange, Flame, Gauge, Languages, Moon, Pencil, Sparkles, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { withLocale } from "@/lib/i18n";
import { coachRequest } from "@/components/coach/api";
import { getCoachCopy } from "@/components/coach/copy";
import { CoachConversation } from "@/components/coach/coach-conversation";
import { CoachGoalForm } from "@/components/coach/coach-goal-form";
import { CoachOverview } from "@/components/coach/coach-overview";
import { CoachPushPrompt } from "@/components/coach/coach-push-prompt";
import { CoachPlanPanel } from "@/components/coach/coach-plan-panel";
import { CoachRunsPanel } from "@/components/coach/coach-runs-panel";
import { CoachSleepPanel } from "@/components/coach/coach-sleep-panel";
import type { CoachDashboardData, CoachLocale, CoachRun } from "@/components/coach/types";
import { cn } from "@/lib/utils";

type CoachView = "overview" | "plan" | "runs" | "sleep" | "coach";

export function CoachDashboard({
  initialData,
  locale,
  profileGaps
}: {
  initialData: CoachDashboardData;
  locale: CoachLocale;
  profileGaps?: { sex: boolean; birthDate: boolean };
}) {
  const [dashboard, setDashboard] = useState(initialData);
  const [view, setView] = useState<CoachView>("overview");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [focusInteractionId, setFocusInteractionId] = useState<string | null>(null);
  // On the phone app the bottom-nav "Runs" screen owns run recording/history, so the Runs
  // tab here would be a duplicate — hide it on native, keep it on the web (no bottom nav).
  // Resolved after mount to avoid a hydration mismatch (SSR always renders the web layout).
  const [isNative, setIsNative] = useState(false);
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const copy = getCoachCopy(locale);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Cross-screen hand-off: the standalone Runs screen sends the runner here with
  // ?focus=<interactionId> after analysing a run, so jump to the coach tab and scroll to it.
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) return;
    setFocusInteractionId(focus);
    setView("coach");
  }, [searchParams]);

  const refresh = useCallback(async () => {
    const payload = await coachRequest<{ data: CoachDashboardData }>("/api/coach");
    setDashboard(payload.data);
  }, []);

  const mutate = useCallback(
    (action: string, operation: () => Promise<void>) => {
      setError(null);
      setPendingAction(action);
      startTransition(async () => {
        try {
          await operation();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : copy.requestFailed);
        } finally {
          setPendingAction(null);
        }
      });
    },
    [copy.requestFailed]
  );

  const runInteraction = useCallback(
    (type: "INITIAL_PLAN" | "WEEKLY_REVIEW" | "POST_RUN" | "CHAT", options?: { runId?: string; message?: string }) =>
      new Promise<void>((resolve, reject) => {
        mutate(type, async () => {
          try {
            const created = await coachRequest<{ data: { id: string } }>("/api/coach/interactions", {
              method: "POST",
              body: JSON.stringify({ type, runId: options?.runId ?? null, message: options?.message ?? null })
            });
            await refresh();
            if (type === "INITIAL_PLAN" || type === "WEEKLY_REVIEW") {
              setView("plan");
            } else if (type === "POST_RUN" || type === "CHAT") {
              // Jump to the coach tab and scroll to the answer we just generated.
              setView("coach");
              setFocusInteractionId(created.data.id);
            }
            resolve();
          } catch (caught) {
            reject(caught);
            throw caught;
          }
        });
      }),
    [mutate, refresh]
  );

  const latestPlan = useMemo(
    () => dashboard.plans.find((plan) => plan.status === "ACTIVE") ?? dashboard.plans.find((plan) => plan.status === "DRAFT") ?? null,
    [dashboard.plans]
  );

  // Map each already-analyzed run to its POST_RUN interaction so the Runs list can jump
  // to the existing analysis instead of generating a duplicate one. Interactions arrive
  // newest-first, so the first match per run is the most recent analysis.
  const analyzedRuns = useMemo(() => {
    // Server map covers every shown run regardless of the interactions window; the scan
    // below adds any just-created analysis that isn't in the server payload yet.
    const map: Record<string, string> = { ...(dashboard.analyzedRuns ?? {}) };
    for (const interaction of dashboard.interactions) {
      if (interaction.type === "POST_RUN" && interaction.runId && interaction.status !== "FAILED" && !map[interaction.runId]) {
        map[interaction.runId] = interaction.id;
      }
    }
    return map;
  }, [dashboard.analyzedRuns, dashboard.interactions]);

  const viewAnalysis = useCallback((interactionId: string) => {
    setFocusInteractionId(interactionId);
    setView("coach");
  }, []);

  const activeGoal = dashboard.goal;
  const setCoachLanguage = useCallback(
    (next: CoachLocale) => {
      if (!activeGoal || next === activeGoal.preferredLocale) return;
      mutate("GOAL_SETTINGS", async () => {
        await coachRequest(`/api/coach/goals/${activeGoal.id}`, {
          method: "PATCH",
          body: JSON.stringify({ preferredLocale: next })
        });
        await refresh();
      });
    },
    [activeGoal, mutate, refresh]
  );

  if (!dashboard.goal) {
    return (
      <div dir={locale === "ar" ? "rtl" : "ltr"}>
        <CoachGoalForm locale={locale} copy={copy} onCreated={refresh} profileGaps={profileGaps} />
      </div>
    );
  }

  const goal = dashboard.goal;

  // Editing the goal reuses the onboarding wizard, pre-filled and in PATCH mode. It takes over the
  // whole surface so the runner focuses on the change, then returns to the dashboard on save/cancel.
  if (editing) {
    return (
      <div className="min-h-[70vh] bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
        <CoachGoalForm
          locale={locale}
          copy={copy}
          initialGoal={goal}
          onCreated={async () => {
            await refresh();
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }
  const metrics = dashboard.snapshot?.metrics ?? emptyMetrics;
  const runTarget = Math.max(2, goal.availableTrainingDays.length);
  const distanceTarget = Math.max(1, Math.round(goal.currentWeeklyDistanceKm));
  const streak = weekStreak(dashboard.runs);
  const views = [
    { id: "overview" as const, label: copy.overview, icon: Gauge },
    { id: "plan" as const, label: copy.plan, icon: CalendarRange },
    // Runs tab is web-only; the phone app reaches runs through the bottom nav.
    ...(isNative ? [] : [{ id: "runs" as const, label: copy.runs, icon: Activity }]),
    { id: "sleep" as const, label: copy.sleep, icon: Moon },
    { id: "coach" as const, label: copy.coach, icon: BrainCircuit }
  ];

  return (
    <div className="min-h-[70vh] bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-5">
          <div className="rz-hide-native mb-5 max-w-3xl">
            <h1 className="text-2xl font-black text-balance text-gray-950 sm:text-3xl">{copy.title}</h1>
            <p className="mt-1.5 text-sm leading-6 text-gray-600">{copy.intro}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {/* Your goal + its edit action, grouped: the goal is the identity (icon + name),
                editing is a secondary action attached to it — not a third equal-weight button. */}
            <span className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-gray-200 bg-white ps-4 pe-2 shadow-sm">
              <Target className="size-4 shrink-0 text-brand-orange" aria-hidden="true" />
              <span className="truncate text-sm font-black text-gray-950">{formatGoal(goal.goalType, goal.customGoal)}</span>
              <span className="h-5 w-0 shrink-0 self-center border-s border-gray-200" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="-me-1.5 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-brand-teal transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              >
                <Pencil className="size-3.5 shrink-0" aria-hidden="true" />
                {copy.editGoal}
              </button>
            </span>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 shadow-sm sm:ms-auto">
              <Languages className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              <span className="sr-only">{copy.responseLanguage}</span>
              <select
                value={goal.preferredLocale}
                onChange={(event) => setCoachLanguage(event.target.value as CoachLocale)}
                disabled={pendingAction === "GOAL_SETTINGS"}
                className="cursor-pointer bg-transparent text-sm font-black text-gray-950 outline-none disabled:opacity-60"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </label>
          </div>
        </header>

        {/* Free-trial nudge: while the runner is inside the free week, remind them how much is
            left and push them to subscribe before the coach locks. Hidden once subscribed. */}
        {dashboard.entitlement?.tier === "TRIAL" && dashboard.entitlement.trialEndsAt ? (
          <TrialBanner endsAt={dashboard.entitlement.trialEndsAt} locale={locale} copy={copy} />
        ) : null}

        {/* This week — the single home for weekly status: distance & runs vs target, pace, fatigue, streak */}
        <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-wide text-gray-500">{copy.thisWeek}</h2>
            {/* 12px bold needs 4.5:1: brand-orange on orange-50 is only 2.59:1 (orangeText is
                the token reserved for text on orange tints, 4.88:1), and gray-500 on gray-100
                is 4.39:1 — both just real enough to matter. */}
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black", streak > 0 ? "bg-orange-50 text-brand-orangeText" : "bg-gray-100 text-gray-600")}>
              <Flame className="size-3.5" aria-hidden="true" />
              {streak} {copy.streakLabel}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
            <ProgressStat label={copy.challengeDistance} display={`${metrics.distanceLast7DaysKm.toFixed(1)} / ${distanceTarget} km`} value={metrics.distanceLast7DaysKm} target={distanceTarget} />
            <ProgressStat label={copy.challengeRuns} display={`${metrics.runCountLast7Days} / ${runTarget}`} value={metrics.runCountLast7Days} target={runTarget} />
            <PlainStat label={copy.avgPace} value={formatMetricPace(metrics.averagePaceLast28DaysSecondsPerKm)} />
            <PlainStat label={copy.fatigue} value={`${metrics.maximumFatigueLast7Days}/10`} />
          </div>
        </section>

        <nav
          className={cn(
            "coach-tabs mb-5 grid rounded-lg border border-gray-200 bg-white p-1 shadow-sm",
            views.length >= 5 ? "grid-cols-5" : views.length === 4 ? "grid-cols-4" : "grid-cols-3"
          )}
          aria-label="Coach views"
        >
          {views.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal sm:flex-row sm:gap-2 sm:text-sm",
                view === id ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="coach-tab-label truncate text-[11px] sm:text-sm">{label}</span>
            </button>
          ))}
        </nav>

        <CoachPushPrompt copy={copy} />

        {error ? (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <span className="mt-0.5 size-2 shrink-0 rounded-full bg-red-500" />
            {error}
          </div>
        ) : null}

        {view === "overview" ? (
          <CoachOverview data={dashboard} latestPlan={latestPlan} locale={locale} copy={copy} tips={dashboard.tips} onOpenPlan={() => setView("plan")} />
        ) : null}
        {view === "plan" ? (
          <CoachPlanPanel
            plans={dashboard.plans}
            locale={locale}
            copy={copy}
            pendingAction={pendingAction}
            onGenerate={(type) => runInteraction(type)}
            onAccept={(planId) =>
              mutate("ACCEPT_PLAN", async () => {
                await coachRequest(`/api/coach/plans/${planId}`, { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) });
                await refresh();
              })
            }
          />
        ) : null}
        {view === "runs" ? (
          <CoachRunsPanel
            runs={dashboard.runs}
            plan={latestPlan}
            locale={locale}
            copy={copy}
            pendingAction={pendingAction}
            onSaved={async (runId, analyze) => {
              await refresh();
              if (analyze) await runInteraction("POST_RUN", { runId });
            }}
            onAnalyze={(runId) => runInteraction("POST_RUN", { runId })}
            analyzedRuns={analyzedRuns}
            onViewAnalysis={viewAnalysis}
            weightKg={goal.weightKg}
          />
        ) : null}
        {view === "sleep" ? (
          <CoachSleepPanel
            entries={dashboard.sleep ?? []}
            locale={locale}
            copy={copy}
            pendingAction={pendingAction}
            onSaved={refresh}
          />
        ) : null}
        {view === "coach" ? (
          <CoachConversation
            interactions={dashboard.interactions}
            locale={locale}
            copy={copy}
            pendingAction={pendingAction}
            canVoice={dashboard.entitlement?.tier === "SUBSCRIBED"}
            focusInteractionId={focusInteractionId}
            onAsk={(message) => runInteraction("CHAT", { message })}
          />
        ) : null}
      </div>
    </div>
  );
}

function TrialBanner({
  endsAt,
  locale,
  copy
}: {
  endsAt: string;
  locale: CoachLocale;
  copy: ReturnType<typeof getCoachCopy>;
}) {
  const msLeft = new Date(endsAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / DAY_MS));
  const heading =
    daysLeft <= 1 ? copy.trialBannerLastDay : copy.trialBannerDaysLeft.replace("{days}", String(daysLeft));

  return (
    <section className="mb-5 flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-950">{heading}</p>
          <p className="mt-0.5 text-sm leading-6 text-gray-700">{copy.trialBannerText}</p>
        </div>
      </div>
      <Link
        href={withLocale("/account/coach/subscribe", locale)}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-orange px-5 text-sm font-black text-white transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        {copy.trialBannerCta}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </section>
  );
}

function ProgressStat({ label, display, value, target }: { label: string; display: string; value: number; target: number }) {
  const percent = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
  const complete = value >= target;
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-1 truncate text-lg font-black tabular-nums", complete ? "text-green-600" : "text-gray-950")}>{display}</p>
      {/* aria-valuetext carries the real figure ("12.4 / 20 km"); without it a screen reader
          announces a bare "62%", which is the least useful part of this stat. */}
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuetext={display}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full transition-all", complete ? "bg-green-500" : "bg-brand-orange")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PlainStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-black tabular-nums text-gray-950">{value}</p>
      <div className="mt-2 h-1.5" aria-hidden="true" />
    </div>
  );
}

// Consecutive 7-day windows (ending today) that each contain at least one run.
const DAY_MS = 24 * 60 * 60 * 1000;
function weekStreak(runs: CoachRun[], now = Date.now()) {
  const times = runs.map((run) => new Date(run.startedAt).getTime()).filter((time) => Number.isFinite(time) && time <= now);
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

function formatGoal(goalType: string, customGoal: string | null) {
  if (customGoal) return customGoal;
  return goalType.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMetricPace(value: number | null) {
  if (!value) return "-";
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}/km`;
}

const emptyMetrics = {
  runCountLast7Days: 0,
  runCountLast28Days: 0,
  distanceLast7DaysKm: 0,
  distancePrevious7DaysKm: 0,
  distanceLast28DaysKm: 0,
  weeklyDistanceChangePercent: null,
  averagePaceLast28DaysSecondsPerKm: null,
  recentPaceChangePercent: null,
  averageEffortLast7Days: null,
  maximumFatigueLast7Days: 0,
  maximumPainLast7Days: 0
};

