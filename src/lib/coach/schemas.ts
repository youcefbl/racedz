import { z } from "zod";

export const coachLocaleSchema = z.enum(["en", "fr", "ar"]);

export const CHRONIC_CONDITIONS = [
  "NONE",
  "ASTHMA",
  "DIABETES",
  "HYPERTENSION",
  "HEART_CONDITION",
  "THYROID",
  "ANEMIA",
  "OTHER"
] as const;

export const chronicConditionSchema = z.enum(CHRONIC_CONDITIONS);

export const createCoachGoalSchema = z
  .object({
    raceEventId: z.string().min(1).max(64).nullable().optional(),
    goalType: z.enum(["GENERAL_FITNESS", "FIVE_K", "TEN_K", "HALF_MARATHON", "MARATHON", "TRAIL", "OTHER"]),
    customGoal: z.string().trim().min(3).max(300).nullable().optional(),
    // Sex and birth date are core profile fields used to personalise the plan; collected here only
    // when missing from the runner's account profile, then saved back to the User record.
    sex: z.enum(["MALE", "FEMALE"]).nullable().optional(),
    dateOfBirth: z.coerce.date().nullable().optional(),
    targetDate: z.coerce.date(),
    targetDistanceKm: z.coerce.number().positive().max(500).nullable().optional(),
    targetTimeSeconds: z.coerce.number().int().positive().max(172800).nullable().optional(),
    experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    currentWeeklyDistanceKm: z.coerce.number().min(0).max(500),
    yearsRunning: z.coerce.number().int().min(0).max(80).nullable().optional(),
    peakWeeklyDistanceKm: z.coerce.number().min(0).max(500).nullable().optional(),
    longestRecentRunKm: z.coerce.number().min(0).max(500).nullable().optional(),
    recentRaceResult: z.string().trim().max(300).nullable().optional(),
    restingHeartRate: z.coerce.number().int().min(30).max(120).nullable().optional(),
    weightKg: z.coerce.number().min(20).max(300).nullable().optional(),
    heightCm: z.coerce.number().int().min(100).max(250).nullable().optional(),
    availableTrainingDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(2)
      // Up to all 7 weekdays — a runner may choose to train every day (the value 0–6 is the
      // weekday; the array length is how many days). Matches the 7-day picker in the form.
      .max(7)
      .refine((days) => new Set(days).size === days.length, "Training days must be unique."),
    preferredLongRunDay: z.coerce.number().int().min(0).max(6).nullable().optional(),
    constraints: z.string().trim().max(1000).nullable().optional(),
    injuryNotes: z.string().trim().max(1000).nullable().optional(),
    injuryHistory: z.string().trim().max(1000).nullable().optional(),
    chronicConditions: z
      .array(chronicConditionSchema)
      .max(8)
      .optional()
      .default([])
      .transform((values) => {
        const unique = Array.from(new Set(values));
        return unique.includes("NONE") ? [] : unique;
      }),
    healthNotes: z.string().trim().max(1000).nullable().optional(),
    preferredLocale: coachLocaleSchema.default("en")
  })
  .superRefine((input, context) => {
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    if (input.targetDate < tomorrow) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetDate"], message: "Target date must be in the future." });
    }

    if (input.goalType === "OTHER" && !input.customGoal) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["customGoal"], message: "Describe the custom goal." });
    }

    if (input.preferredLongRunDay !== null && input.preferredLongRunDay !== undefined && !input.availableTrainingDays.includes(input.preferredLongRunDay)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preferredLongRunDay"],
        message: "Long-run day must be one of the available training days."
      });
    }
  });

export const updateCoachGoalStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"])
});

export const updateCoachGoalSettingsSchema = z.object({
  preferredLocale: coachLocaleSchema
});

export const runRoutePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  ele: z.number().min(-500).max(9000).nullable().optional(),
  t: z.number().int().nonnegative().nullable().optional()
});

// Photos are stored as public URLs produced by our own uploads endpoint. Restricting to the
// `/uploads/run/` prefix means a client can only attach images it actually uploaded here, not
// paste an arbitrary external URL into the run record.
export const runPhotosSchema = z
  .array(z.string().trim().min(1).max(300).startsWith("/uploads/run/"))
  .max(6)
  .transform((urls) => Array.from(new Set(urls)));

export const createRunnerRunSchema = z.object({
  goalId: z.string().min(1).max(64).nullable().optional(),
  workoutId: z.string().min(1).max(64).nullable().optional(),
  startedAt: z.coerce.date().refine((value) => value.getTime() <= Date.now() + 5 * 60 * 1000, "Run cannot be in the future."),
  distanceKm: z.coerce.number().min(0.1).max(500),
  durationSeconds: z.coerce.number().int().min(60).max(172800),
  movingTimeSeconds: z.coerce.number().int().min(0).max(172800).nullable().optional(),
  elevationGainM: z.coerce.number().int().min(0).max(20000).nullable().optional(),
  averageHeartRate: z.coerce.number().int().min(30).max(250).nullable().optional(),
  avgCadence: z.coerce.number().int().min(0).max(300).nullable().optional(),
  calories: z.coerce.number().int().min(0).max(50000).nullable().optional(),
  weightKg: z.coerce.number().min(20).max(300).nullable().optional(),
  source: z.enum(["MANUAL", "GPS", "IMPORTED"]).default("MANUAL"),
  isPublic: z.coerce.boolean().optional().default(false),
  route: z.array(runRoutePointSchema).max(20000).nullable().optional(),
  perceivedEffort: z.coerce.number().int().min(1).max(10),
  fatigueLevel: z.coerce.number().int().min(0).max(10).default(0),
  painLevel: z.coerce.number().int().min(0).max(10).default(0),
  title: z.string().trim().max(120).nullable().optional(),
  symptoms: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  photos: runPhotosSchema.optional()
});

// Partial update from the runs list: flip visibility and/or attach photos after the fact.
export const updateRunnerRunSchema = z
  .object({
    isPublic: z.coerce.boolean().optional(),
    photos: runPhotosSchema.optional()
  })
  .refine((input) => input.isPublic !== undefined || input.photos !== undefined, {
    message: "Nothing to update."
  });

// A clock time as "HH:MM" in 24-hour form, e.g. "23:30" or "06:15".
export const sleepClockTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time.");

// Three ways to log a night's sleep: a plain duration in hours, bed + wake clock times, or a
// free-text description in any language that the AI turns into a duration. At least one must be
// provided; the service resolves them all down to durationMinutes.
export const createSleepLogSchema = z
  .object({
    // The night this sleep is for. Defaults to last night (resolved server-side) when omitted.
    night: z.coerce.date().nullable().optional(),
    durationHours: z.coerce.number().min(0).max(24).nullable().optional(),
    bedTime: sleepClockTimeSchema.nullable().optional(),
    wakeTime: sleepClockTimeSchema.nullable().optional(),
    text: z.string().trim().min(1).max(300).nullable().optional(),
    note: z.string().trim().max(300).nullable().optional()
  })
  .superRefine((input, context) => {
    const hasDuration = input.durationHours !== null && input.durationHours !== undefined;
    const hasBoth = Boolean(input.bedTime) && Boolean(input.wakeTime);
    const hasOneTime = Boolean(input.bedTime) !== Boolean(input.wakeTime);
    const hasText = Boolean(input.text);

    if (hasOneTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [input.bedTime ? "wakeTime" : "bedTime"],
        message: "Provide both bed time and wake time."
      });
    }

    if (!hasDuration && !hasBoth && !hasText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationHours"],
        message: "Enter hours slept, bed and wake times, or describe your sleep."
      });
    }

    if (input.night && input.night.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["night"], message: "Night cannot be in the future." });
    }
  });

export const coachInteractionInputSchema = z
  .object({
    type: z.enum(["INITIAL_PLAN", "POST_RUN", "WEEKLY_REVIEW", "CHAT"]),
    runId: z.string().min(1).max(64).nullable().optional(),
    message: z.string().trim().max(1200).nullable().optional()
  })
  .superRefine((input, context) => {
    if (input.type === "POST_RUN" && !input.runId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["runId"], message: "Post-run feedback requires a run." });
    }

    if (input.type === "CHAT" && !input.message) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["message"], message: "Coach chat requires a message." });
    }
  });

export const coachWorkoutSchema = z.object({
  scheduledFor: z.string().datetime(),
  workoutType: z.enum(["EASY", "LONG_RUN", "TEMPO", "INTERVAL", "RECOVERY", "REST", "CROSS_TRAINING", "RACE"]),
  title: z.string().min(1).max(120),
  targetDistanceKm: z.number().min(0).max(500).nullable(),
  targetDurationMin: z.number().int().min(0).max(1440).nullable(),
  intensity: z.string().min(1).max(120),
  instructions: z.string().min(1).max(1200)
});

export const coachResponseSchema = z.object({
  summary: z.string().min(1).max(1200),
  progressAssessment: z.string().min(1).max(1200),
  positiveSignals: z.array(z.string().min(1).max(300)).max(6),
  warningSignals: z.array(z.string().min(1).max(300)).max(6),
  nextWorkout: coachWorkoutSchema.nullable(),
  upcomingWorkouts: z.array(coachWorkoutSchema).max(7),
  recoveryAdvice: z.array(z.string().min(1).max(300)).max(6),
  requiresProfessionalAdvice: z.boolean(),
  // Transparency & anti-hallucination (Phase: context hardening). Required arrays (empty when none)
  // and a nullable single follow-up keep the response strict-mode compatible.
  // Which context signals the coach actually leaned on (e.g. "adherence", "recent pace", "sleep").
  usedSignals: z.array(z.string().min(1).max(80)).max(8),
  // Important information that was missing, so the coach flags uncertainty instead of inventing facts.
  dataGaps: z.array(z.string().min(1).max(200)).max(6),
  // At most one clarifying question when personalization is limited by missing data; null otherwise.
  followUpQuestion: z.string().min(1).max(300).nullable(),
  // Durable facts the runner stated in THIS conversation that are worth remembering (Phase 3). The
  // model proposes; the application validates against the writable-kind allowlist before storing, so a
  // proposal here is never a guarantee of a write. Health facts are refused at the write layer.
  memoryCandidates: z
    .array(
      z.object({
        kind: z.enum(["PREFERENCE", "COACHING_TONE", "SCHEDULE", "TERRAIN", "CONSTRAINT", "COMMITMENT"]),
        key: z.string().min(1).max(64),
        value: z.string().min(1).max(300),
        confidence: z.number().min(0).max(1)
      })
    )
    .max(3)
});

export type CoachLocale = z.infer<typeof coachLocaleSchema>;
export type CreateCoachGoalInput = z.infer<typeof createCoachGoalSchema>;
export type CreateRunnerRunInput = z.infer<typeof createRunnerRunSchema>;
export type UpdateRunnerRunInput = z.infer<typeof updateRunnerRunSchema>;
export type CreateSleepLogInput = z.infer<typeof createSleepLogSchema>;
export type CoachInteractionInput = z.infer<typeof coachInteractionInputSchema>;
export type CoachResponse = z.infer<typeof coachResponseSchema>;
export type CoachWorkout = z.infer<typeof coachWorkoutSchema>;
