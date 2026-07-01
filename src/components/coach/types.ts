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
  symptoms: string | null;
  notes: string | null;
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
  intensity: string;
  instructions: string;
  status?: string;
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
  status: "PENDING" | "COMPLETED" | "BLOCKED" | "FAILED";
  userMessage: string | null;
  response: CoachResponse | null;
  safety: { level?: "CLEAR" | "CAUTION" | "BLOCKED"; reasons?: string[] };
  model: string | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
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
};

export type CoachApiError = {
  error?: string;
  code?: string;
  fields?: Record<string, string[]>;
};
