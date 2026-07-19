export type CoachLocale = "en" | "fr" | "ar";

export type CoachGoal = {
  id: string;
  goalType: string;
  customGoal: string | null;
  targetDate: string;
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
  preferredLocale: CoachLocale;
  status: string;
};

export type CoachRun = {
  id: string;
  goalId: string | null;
  workoutId: string | null;
  // How this run linked to its workout (EXPLICIT / AUTO / RUNNER_CONFIRMED), null when free.
  workoutMatchSource?: string | null;
  startedAt: string;
  distanceKm: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number;
  movingTimeSeconds: number | null;
  elevationGainM: number | null;
  averageHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
  route: RunRoutePoint[] | null;
  isPublic: boolean;
  perceivedEffort: number;
  fatigueLevel: number;
  painLevel: number;
  title: string | null;
  symptoms: string | null;
  notes: string | null;
  photos: string[] | null;
};

export type RunRoutePoint = {
  lat: number;
  lng: number;
  ele?: number | null;
  t?: number | null;
};

export type CoachMetrics = {
  runCountLast7Days: number;
  runCountLast28Days: number;
  distanceLast7DaysKm: number;
  distancePrevious7DaysKm: number;
  distanceLast28DaysKm: number;
  weeklyDistanceChangePercent: number | null;
  averagePaceLast28DaysSecondsPerKm: number | null;
  recentPaceChangePercent: number | null;
  averageEffortLast7Days: number | null;
  maximumFatigueLast7Days: number;
  maximumPainLast7Days: number;
};

export type CoachWorkout = {
  id?: string;
  scheduledFor: string;
  workoutType: string;
  title: string;
  targetDistanceKm: number | null;
  targetDurationMin: number | null;
  // Pace target in seconds per km, derived by the adaptive planner. Absent on older workouts and on
  // sessions where the runner had no reliable recent pace to derive one from.
  targetPaceSecondsPerKm?: number | null;
  intensity: string;
  instructions: string;
  status?: string;
  // Phase 1 outcome metadata (present on persisted workouts; absent on freshly generated skeletons).
  completionType?: string | null;
  skipReason?: string | null;
  runnerNote?: string | null;
};

// A medium-confidence run→workout match the matcher surfaced for the runner to confirm (Phase 1.3).
export type CoachSuggestedMatch = { workoutId: string; title: string; confidence: number };

// Deterministic plan-adherence summary (server: src/lib/coach/adherence.ts). hasActivePlan is false
// for a free runner, so the UI shows a "no plan" state rather than a discouraging 0%.
export type CoachAdherence = {
  hasActivePlan: boolean;
  plannedSessions: number;
  completedSessions: number;
  skippedSessions: number;
  remainingSessions: number;
  completionRate: number;
  plannedDistanceKm: number;
  completedDistanceKm: number;
  longRun: { planned: boolean; completed: boolean };
  consecutiveMissed: number;
};

export type CoachPlan = {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "SUPERSEDED" | "COMPLETED" | "CANCELLED";
  startsOn: string;
  endsOn: string;
  summary: string | null;
  workouts: CoachWorkout[];
};

export type CoachResponse = {
  summary: string;
  progressAssessment: string;
  positiveSignals: string[];
  warningSignals: string[];
  nextWorkout: CoachWorkout | null;
  upcomingWorkouts: CoachWorkout[];
  recoveryAdvice: string[];
  requiresProfessionalAdvice: boolean;
};

export type CoachInteraction = {
  id: string;
  type: "INITIAL_PLAN" | "POST_RUN" | "WEEKLY_REVIEW" | "CHAT";
  runId: string | null;
  status: "PENDING" | "COMPLETED" | "BLOCKED" | "FAILED";
  userMessage: string | null;
  response: CoachResponse | null;
  safety: { level?: "CLEAR" | "CAUTION" | "BLOCKED"; reasons?: string[] };
  model: string | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type CoachSleepEntry = {
  id: string;
  // Calendar night the sleep is for, as an ISO date string (serialised from a DB DATE).
  night: string;
  durationMinutes: number;
  bedTime: string | null;
  wakeTime: string | null;
  note: string | null;
  source: "MANUAL" | "PARSED";
  createdAt: string;
};

export type CoachEntitlement = {
  tier: "SUBSCRIBED" | "TRIAL" | "NONE";
  dailyLimit: number;
  monthlyLimit: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  plan: string | null;
  usage: { daily: number; monthly: number } | null;
};

export type CoachDashboardData = {
  goal: CoachGoal | null;
  runs: CoachRun[];
  plans: CoachPlan[];
  interactions: CoachInteraction[];
  snapshot: { metrics: CoachMetrics; generatedAt: string } | null;
  entitlement?: CoachEntitlement | null;
  // Published tips matched to the runner's profile and localized, ready to display.
  tips?: string[];
  // runId -> its latest analysis interaction id, for every shown run (window-independent).
  analyzedRuns?: Record<string, string>;
  // Recent nights of logged sleep, newest first.
  sleep?: CoachSleepEntry[];
  // Plan-adherence summary for the active plan (null-safe: hasActivePlan:false when there's no plan).
  adherence?: CoachAdherence;
};

export type CoachApiError = {
  error?: string;
  code?: string;
  fields?: Record<string, string[]>;
};
