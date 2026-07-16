import type { RunRoutePoint } from "@/components/coach/types";
import type { PlanAdherence } from "@/lib/coach/adherence";
import type { CoachMetrics, ConsistencyAssessment, IntensityDistribution, MetricRun } from "@/lib/coach/metrics";
import { computeSplits } from "@/lib/coach/run-stats";
import type { CoachInteractionInput, CoachWorkout } from "@/lib/coach/schemas";
import type { CoachSafetyDecision } from "@/lib/coach/safety";
import type { ForecastConditions, RunWeather } from "@/lib/coach/weather";

// The runner's home region and, when a goal targets a real race, that race's course and setting.
// Both let the coach ground advice in where the runner trains and races — heat, terrain, timing.
type ContextLocation = { wilaya: string | null; city: string | null };
type ContextTargetRace = {
  title: string;
  raceType: string;
  startDate: Date;
  wilaya: string;
  city: string;
  elevationGainText: string | null;
  conditions: string | null;
  latitude: number | null;
  longitude: number | null;
};

type ContextGoal = {
  id: string;
  goalType: string;
  customGoal: string | null;
  targetDate: Date;
  targetDistanceKm: number | null;
  targetTimeSeconds: number | null;
  experienceLevel: string;
  currentWeeklyDistanceKm: number;
  yearsRunning: number | null;
  peakWeeklyDistanceKm: number | null;
  longestRecentRunKm: number | null;
  recentRaceResult: string | null;
  restingHeartRate: number | null;
  weightKg: number | null;
  heightCm: number | null;
  availableTrainingDays: number[];
  preferredLongRunDay: number | null;
  constraints: string | null;
  injuryNotes: string | null;
  injuryHistory: string | null;
  chronicConditions: string[];
  healthNotes: string | null;
  preferredLocale: "en" | "fr" | "ar";
};

type ContextRun = MetricRun & {
  id: string;
  averagePaceSecondsPerKm: number;
  elevationGainM: number | null;
  averageHeartRate: number | null;
  avgCadence: number | null;
  symptoms: string | null;
  notes: string | null;
  // Persisted as JSONB, so it arrives untyped from the DB; describeWeather validates the shape.
  weather?: unknown;
};

type TargetRun = ContextRun & {
  movingTimeSeconds?: number | null;
  calories?: number | null;
  route?: RunRoutePoint[] | null;
};

// One prior coach exchange, condensed to what keeps the conversation coherent: the runner's
// question (if any) and a short trace of what the coach already told them. Lets each reply
// build on recent history instead of repeating advice the runner just received.
export type ConversationTurn = {
  type: CoachInteractionInput["type"];
  at: Date | string;
  runnerQuestion: string | null;
  coachSummary: string | null;
};

// Guardrails so one runner's free-text or GPS history can never blow up the prompt. We keep the
// full picture when it fits and only trim the long tail (older runs, verbose notes) when it doesn't.
const MAX_RECENT_RUNS = 10;
const MAX_CONVERSATION_TURNS = 6;
const MAX_NOTE_CHARS = 500;
const MAX_SUMMARY_CHARS = 400;
const COMPACT_THRESHOLD_CHARS = 14000;

export function buildRunnerCoachContext(input: {
  goal: ContextGoal;
  runs: ContextRun[];
  metrics: CoachMetrics;
  skeleton: CoachWorkout[];
  safety: CoachSafetyDecision;
  interaction: CoachInteractionInput;
  profile?: { sex: string | null; age: number | null };
  consistency?: ConsistencyAssessment | null;
  intensity?: IntensityDistribution | null;
  location?: ContextLocation | null;
  targetRace?: ContextTargetRace | null;
  forecast?: ForecastConditions | null;
  sleep?: Array<{ night: Date | string; durationMinutes: number }>;
  nutrition?: string | null;
  targetRun?: TargetRun | null;
  recentConversation?: ConversationTurn[];
  adherence?: PlanAdherence | null;
}) {
  const context = {
    request: {
      type: input.interaction.type,
      runnerQuestion: input.interaction.message ?? null,
      responseLocale: input.goal.preferredLocale
    },
    runner: {
      sex: input.profile?.sex ?? null,
      age: input.profile?.age ?? null,
      // Where the runner is based, so the coach can factor in local climate and time of day.
      location: input.location ? { wilaya: input.location.wilaya, city: input.location.city } : null
    },
    goal: {
      type: input.goal.goalType,
      customGoal: input.goal.customGoal,
      targetDate: input.goal.targetDate.toISOString(),
      targetDistanceKm: input.goal.targetDistanceKm,
      targetTimeSeconds: input.goal.targetTimeSeconds,
      experienceLevel: input.goal.experienceLevel,
      declaredWeeklyDistanceKm: input.goal.currentWeeklyDistanceKm,
      yearsRunning: input.goal.yearsRunning,
      peakWeeklyDistanceKm: input.goal.peakWeeklyDistanceKm,
      longestRecentRunKm: input.goal.longestRecentRunKm,
      recentRaceResult: input.goal.recentRaceResult,
      restingHeartRate: input.goal.restingHeartRate,
      weightKg: input.goal.weightKg,
      heightCm: input.goal.heightCm,
      bmi: computeBmi(input.goal.weightKg, input.goal.heightCm),
      availableTrainingDays: input.goal.availableTrainingDays,
      preferredLongRunDay: input.goal.preferredLongRunDay,
      constraints: input.goal.constraints,
      injuryNotes: input.goal.injuryNotes,
      injuryHistory: input.goal.injuryHistory,
      chronicConditions: input.goal.chronicConditions,
      healthNotes: input.goal.healthNotes
    },
    computedMetrics: input.metrics,
    // Whether the runner is keeping to their committed cadence, so the coach can nudge them back to
    // consistency when sessions are being skipped and acknowledge it when they're on track.
    consistency: input.consistency ?? null,
    // Easy/grey-zone/hard split of recent efforts, so the coach can hold the runner to the 80/20
    // principle — keep easy days easy — instead of letting them drift into the moderate grey zone.
    intensityDistribution: input.intensity ?? null,
    // Recent sleep the runner logged, so the coach can factor rest into recovery and load advice
    // (short or erratic sleep → prioritise recovery; consistent good sleep → affirm it).
    sleep: describeSleep(input.sleep ?? []),
    // Recent fuel/hydration averages the runner logged, so the coach can advise on fueling around
    // long runs and race week. Null when nothing is logged.
    nutrition: input.nutrition ?? null,
    // The actual race being trained for (course, terrain, where and when), when the goal links one,
    // plus how many days remain — lets the coach tailor course prep instead of echoing the goal.
    targetRace: input.targetRace ? describeTargetRace(input.targetRace) : null,
    // Current + today's forecast where the runner trains, so planning and chat can adapt to heat,
    // humidity and rain (move a hard session earlier, swap to easy, hydrate). Null for post-run.
    environment: input.forecast ? describeForecast(input.forecast) : null,
    // The specific run this feedback is about, when the runner asked to analyse one. Given its
    // own block (with per-km splits) so the coach centres the reply on it instead of guessing.
    analysedRun: input.targetRun ? describeTargetRun(input.targetRun) : null,
    recentRuns: input.runs.slice(0, MAX_RECENT_RUNS).map(describeRun),
    // Prior exchanges, oldest→newest, so the coach can reference what the runner asked recently.
    recentConversation: (input.recentConversation ?? [])
      .slice(-MAX_CONVERSATION_TURNS)
      .map((turn) => ({
        type: turn.type,
        at: new Date(turn.at).toISOString(),
        runnerQuestion: truncate(turn.runnerQuestion, MAX_NOTE_CHARS),
        coachSummary: truncate(turn.coachSummary, MAX_SUMMARY_CHARS)
      })),
    // What was actually planned vs done on the active plan (completed / skipped / completion rate /
    // consecutive misses), so the coach can reference real adherence and adapt to missed sessions
    // instead of assuming everything went to plan. Null when the runner has no active plan.
    planAdherence: input.adherence ?? null,
    fixedSafetyDecision: input.safety,
    fixedWeeklyPlanSkeleton: input.skeleton
  };

  return compactIfNeeded(context);
}

function describeRun(run: ContextRun) {
  return {
    startedAt: new Date(run.startedAt).toISOString(),
    distanceKm: run.distanceKm,
    durationSeconds: run.durationSeconds,
    averagePaceSecondsPerKm: run.averagePaceSecondsPerKm,
    elevationGainM: run.elevationGainM,
    averageHeartRate: run.averageHeartRate,
    avgCadence: run.avgCadence,
    perceivedEffort: run.perceivedEffort,
    fatigueLevel: run.fatigueLevel,
    painLevel: run.painLevel,
    // Conditions the run was performed in, so a slow/hard day in heat isn't misread as lost fitness.
    weather: describeWeather(run.weather),
    symptoms: truncate(run.symptoms, MAX_NOTE_CHARS),
    notes: truncate(run.notes, MAX_NOTE_CHARS)
  };
}

// Normalise the JSONB weather snapshot into a compact, model-friendly block. Tolerant of null or
// malformed rows (returns null), and flags wilaya-centroid readings as approximate so the coach
// can hedge on location.
function describeWeather(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const weather = value as Partial<RunWeather>;
  if (weather.temperatureC == null && !weather.label) return null;
  return {
    temperatureC: weather.temperatureC ?? null,
    feelsLikeC: weather.apparentTemperatureC ?? null,
    humidityPct: weather.humidityPct ?? null,
    windKph: weather.windKph ?? null,
    precipitationMm: weather.precipitationMm ?? null,
    conditions: weather.label ?? null,
    approxLocation: weather.source === "wilaya"
  };
}

// Whole days from now until a date, floored; negative if already past.
function daysUntil(date: Date): number {
  return Math.floor((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function describeTargetRace(race: ContextTargetRace) {
  return {
    title: race.title,
    raceType: race.raceType,
    startDate: new Date(race.startDate).toISOString(),
    daysUntilRace: daysUntil(race.startDate),
    location: [race.city, race.wilaya].filter(Boolean).join(", ") || null,
    courseElevation: race.elevationGainText,
    courseConditions: truncate(race.conditions, MAX_NOTE_CHARS)
  };
}

// Summarise recent sleep into what the coach actually needs: the average over the last week, the
// most recent night, and a short per-night trace (hours, one decimal). Null when nothing is logged.
function describeSleep(entries: Array<{ night: Date | string; durationMinutes: number }>) {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => new Date(b.night).getTime() - new Date(a.night).getTime());
  const toHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
  const lastSeven = sorted.slice(0, 7);
  const averageHoursLast7 =
    lastSeven.length > 0
      ? Math.round((lastSeven.reduce((total, entry) => total + entry.durationMinutes, 0) / lastSeven.length / 60) * 10) /
        10
      : null;

  return {
    nightsLoggedLast7: lastSeven.length,
    averageHoursLast7,
    lastNightHours: toHours(sorted[0].durationMinutes),
    recentNights: sorted.slice(0, 7).map((entry) => ({
      night: new Date(entry.night).toISOString().slice(0, 10),
      hours: toHours(entry.durationMinutes)
    }))
  };
}

function describeForecast(forecast: ForecastConditions) {
  return {
    conditions: forecast.label,
    currentTemperatureC: forecast.currentTemperatureC,
    feelsLikeC: forecast.apparentTemperatureC,
    humidityPct: forecast.humidityPct,
    windKph: forecast.windKph,
    todayHighC: forecast.todayHighC,
    todayLowC: forecast.todayLowC,
    precipitationChancePct: forecast.precipitationChancePct,
    approxLocation: forecast.source === "wilaya"
  };
}

function describeTargetRun(run: TargetRun) {
  const splits = computeSplits(run.route ?? null).map((split) => ({
    km: split.index,
    meters: split.meters,
    paceSecondsPerKm: split.paceSecondsPerKm,
    elevationGainM: split.elevationGainM,
    fastest: split.fastest ?? false,
    slowest: split.slowest ?? false
  }));

  return {
    ...describeRun(run),
    movingTimeSeconds: run.movingTimeSeconds ?? null,
    calories: run.calories ?? null,
    // Per-kilometre splits let the coach comment on pacing (fade, negative split, hills) precisely.
    perKmSplits: splits.length ? splits : null
  };
}

// Body Mass Index (kg/m²), rounded to one decimal. Null when weight or height is unknown,
// giving the coach a quick read on the runner's build alongside raw weight and height.
function computeBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed || null;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

// Each runner's context is built fresh, so it stays personal by construction. Compaction only
// kicks in for the rare runner whose serialized context is unusually large (many long runs plus
// verbose notes): we drop the oldest recent runs and trim conversation history, keeping the
// analysed run, goal, metrics and latest exchanges — the details that drive the reply — intact.
function compactIfNeeded<T extends { recentRuns: unknown[]; recentConversation: unknown[] }>(context: T): T {
  if (JSON.stringify(context).length <= COMPACT_THRESHOLD_CHARS) return context;
  return {
    ...context,
    recentRuns: context.recentRuns.slice(0, 5),
    recentConversation: context.recentConversation.slice(-3)
  };
}
