"use client";

import { Activity, BrainCircuit, CalendarRange, Gauge, Languages, Route, Sparkles, Target, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { coachRequest } from "@/components/coach/api";
import { getCoachCopy } from "@/components/coach/copy";
import { CoachConversation } from "@/components/coach/coach-conversation";
import { CoachGoalForm } from "@/components/coach/coach-goal-form";
import { CoachMotivation } from "@/components/coach/coach-motivation";
import { CoachOverview } from "@/components/coach/coach-overview";
import { CoachPushPrompt } from "@/components/coach/coach-push-prompt";
import { CoachPlanPanel } from "@/components/coach/coach-plan-panel";
import { CoachRunsPanel } from "@/components/coach/coach-runs-panel";
import type { CoachCopy } from "@/components/coach/copy";
import type { CoachDashboardData, CoachEntitlement, CoachLocale } from "@/components/coach/types";
import { cn } from "@/lib/utils";

type CoachView = "overview" | "plan" | "runs" | "coach";

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
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [focusInteractionId, setFocusInteractionId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const copy = getCoachCopy(locale);

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
        {dashboard.entitlement ? (
          <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-8">
            <EntitlementBanner entitlement={dashboard.entitlement} copy={copy} locale={locale} />
          </div>
        ) : null}
        <CoachGoalForm locale={locale} copy={copy} onCreated={refresh} profileGaps={profileGaps} />
      </div>
    );
  }

  const goal = dashboard.goal;
  const metrics = dashboard.snapshot?.metrics ?? emptyMetrics;
  const views = [
    { id: "overview" as const, label: copy.overview, icon: Gauge },
    { id: "plan" as const, label: copy.plan, icon: CalendarRange },
    { id: "runs" as const, label: copy.runs, icon: Activity },
    { id: "coach" as const, label: copy.coach, icon: BrainCircuit }
  ];

  return (
    <div className="min-h-[70vh] bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl rz-hide-native">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-teal">
              <Sparkles className="size-4 text-brand-orange" aria-hidden="true" />
              {copy.eyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black text-gray-950 sm:text-4xl">{copy.title}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">{copy.intro}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand-orange">
                <Target className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-gray-500">{copy.currentGoal}</p>
                <p className="truncate text-sm font-black text-gray-950">{formatGoal(goal.goalType, goal.customGoal)}</p>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                <Languages className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold uppercase text-gray-500">{copy.responseLanguage}</span>
                <select
                  value={goal.preferredLocale}
                  onChange={(event) => setCoachLanguage(event.target.value as CoachLocale)}
                  disabled={pendingAction === "GOAL_SETTINGS"}
                  className="mt-0.5 w-full cursor-pointer bg-transparent text-sm font-black text-gray-950 outline-none disabled:opacity-60"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </label>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:grid-cols-4">
          <Metric icon={Route} label={copy.thisWeek} value={`${metrics.distanceLast7DaysKm.toFixed(1)} km`} />
          <Metric icon={TrendingUp} label={copy.last28} value={`${metrics.distanceLast28DaysKm.toFixed(1)} km`} />
          <Metric icon={Gauge} label={copy.avgPace} value={formatMetricPace(metrics.averagePaceLast28DaysSecondsPerKm)} />
          <Metric icon={Activity} label={copy.fatigue} value={`${metrics.maximumFatigueLast7Days}/10`} />
        </section>

        <nav className="coach-tabs mb-5 grid grid-cols-4 rounded-lg border border-gray-200 bg-white p-1 shadow-sm" aria-label="Coach views">
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

        {dashboard.entitlement ? (
          <div className="mb-5">
            <EntitlementBanner entitlement={dashboard.entitlement} copy={copy} locale={locale} />
          </div>
        ) : null}

        <CoachPushPrompt copy={copy} />

        {error ? (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <span className="mt-0.5 size-2 shrink-0 rounded-full bg-red-500" />
            {error}
          </div>
        ) : null}

        {view === "overview" ? (
          <>
            <CoachMotivation goal={goal} runs={dashboard.runs} metrics={metrics} tips={dashboard.tips} copy={copy} />
            <CoachOverview data={dashboard} latestPlan={latestPlan} locale={locale} copy={copy} onOpenPlan={() => setView("plan")} />
          </>
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

function EntitlementBanner({
  entitlement,
  copy,
  locale
}: {
  entitlement: CoachEntitlement;
  copy: CoachCopy;
  locale: CoachLocale;
}) {
  const usage = entitlement.usage
    ? copy.dailyUsageLabel.replace("{used}", String(entitlement.usage.daily)).replace("{limit}", String(entitlement.dailyLimit))
    : null;

  if (entitlement.tier === "NONE") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm font-black text-red-800">{copy.subscriptionRequiredTitle}</p>
        <p className="mt-1 text-sm leading-6 text-red-700">{copy.subscriptionRequiredText}</p>
      </div>
    );
  }

  if (entitlement.tier === "TRIAL") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm font-bold text-blue-800">
          <span className="me-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">{copy.trialBadge}</span>
          {entitlement.trialEndsAt ? copy.trialEndsIn.replace("{date}", formatBannerDate(entitlement.trialEndsAt, locale)) : null}
        </p>
        {usage ? <span className="text-xs font-bold text-blue-700">{usage}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
      <p className="text-sm font-bold text-green-800">
        {entitlement.subscriptionEndsAt ? copy.subscribedUntil.replace("{date}", formatBannerDate(entitlement.subscriptionEndsAt, locale)) : null}
      </p>
      {usage ? <span className="text-xs font-bold text-green-700">{usage}</span> : null}
    </div>
  );
}

function formatBannerDate(iso: string, locale: CoachLocale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale === "ar" ? "ar" : locale === "fr" ? "fr" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function Metric({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-e border-gray-200 p-4 last:border-e-0 lg:border-b-0">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
        <span className="truncate text-xs font-bold uppercase">{label}</span>
      </div>
      <p className="mt-2 truncate text-xl font-black text-gray-950 sm:text-2xl">{value}</p>
    </div>
  );
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

