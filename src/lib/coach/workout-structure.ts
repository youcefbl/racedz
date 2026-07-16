import type { CoachLocale } from "@/components/coach/types";

// Structured workouts: the segment-by-segment shape of a session (warm-up, work reps, recoveries,
// cool-down) that the recorder walks the runner through in real time. Plans already say "tempo" or
// "6×400m", but a plain description can't guide you mid-run. This turns a workout's type + targets
// into an ordered set of executable steps with per-step goals, so the recorder can show "now: 400 m
// hard", count it down, and auto-advance.
//
// Structures are DERIVED from the existing `TrainingWorkout` fields at runtime (no schema change,
// so every already-planned workout gets guidance for free). A stored/custom structure can be layered
// on later without changing the execution engine.

export type StepRole = "WARMUP" | "WORK" | "RECOVERY" | "STEADY" | "COOLDOWN";
export type StepIntensity = "EASY" | "MODERATE" | "HARD";

export type StepTarget =
  | { type: "TIME"; seconds: number }
  | { type: "DISTANCE"; meters: number }
  | { type: "OPEN" }; // runner ends it themselves (e.g. free cool-down)

export type WorkoutStep = {
  role: StepRole;
  intensity: StepIntensity;
  target: StepTarget;
};

export type WorkoutBlock =
  | { kind: "single"; step: WorkoutStep }
  | { kind: "repeat"; times: number; steps: WorkoutStep[] };

export type WorkoutStructure = {
  blocks: WorkoutBlock[];
};

// A single step in execution order, with its position and (for repeated blocks) which rep it is.
export type ExecStep = WorkoutStep & {
  index: number;
  total: number;
  rep?: { current: number; total: number };
};

type BuildInput = {
  workoutType: string;
  targetDistanceKm: number | null;
  targetDurationMin: number | null;
};

const WARMUP_SECONDS = 10 * 60;
const COOLDOWN_SECONDS = 10 * 60;

export function targetSeconds(target: StepTarget): number | null {
  return target.type === "TIME" ? target.seconds : null;
}

export function targetMeters(target: StepTarget): number | null {
  return target.type === "DISTANCE" ? target.meters : null;
}

// Expand a structure into a flat, ordered list of executable steps (repeats unrolled).
export function flattenStructure(structure: WorkoutStructure): ExecStep[] {
  const steps: Array<WorkoutStep & { rep?: { current: number; total: number } }> = [];
  for (const block of structure.blocks) {
    if (block.kind === "single") {
      steps.push(block.step);
    } else {
      for (let rep = 0; rep < block.times; rep += 1) {
        for (const step of block.steps) {
          steps.push({ ...step, rep: { current: rep + 1, total: block.times } });
        }
      }
    }
  }
  const total = steps.length;
  return steps.map((step, index) => ({ ...step, index, total }));
}

// Derive a runnable structure from a planned workout. Returns null for non-run workouts
// (rest / cross-training) that have nothing to guide.
export function buildWorkoutStructure(workout: BuildInput): WorkoutStructure | null {
  const type = workout.workoutType?.toUpperCase();
  const distanceKm = workout.targetDistanceKm ?? null;
  const durationMin = workout.targetDurationMin ?? null;

  if (type === "REST" || type === "CROSS_TRAINING") return null;

  if (type === "INTERVAL") {
    // Reps scale gently with the session's distance; each rep is 400 m hard + 90 s easy jog.
    const reps = clamp(Math.round(distanceKm ?? 6), 4, 10);
    return {
      blocks: [
        { kind: "single", step: { role: "WARMUP", intensity: "EASY", target: { type: "TIME", seconds: WARMUP_SECONDS } } },
        {
          kind: "repeat",
          times: reps,
          steps: [
            { role: "WORK", intensity: "HARD", target: { type: "DISTANCE", meters: 400 } },
            { role: "RECOVERY", intensity: "EASY", target: { type: "TIME", seconds: 90 } }
          ]
        },
        { kind: "single", step: { role: "COOLDOWN", intensity: "EASY", target: { type: "TIME", seconds: COOLDOWN_SECONDS } } }
      ]
    };
  }

  if (type === "TEMPO") {
    // Sustained sub-threshold block, bookended by an easy warm-up and cool-down.
    const tempoSeconds = durationMin
      ? Math.max(10 * 60, durationMin * 60 - WARMUP_SECONDS - COOLDOWN_SECONDS)
      : null;
    const tempoMeters = !tempoSeconds && distanceKm ? Math.max(2000, Math.round((distanceKm - 3) * 1000)) : null;
    const tempoTarget: StepTarget = tempoSeconds
      ? { type: "TIME", seconds: tempoSeconds }
      : tempoMeters
        ? { type: "DISTANCE", meters: tempoMeters }
        : { type: "TIME", seconds: 20 * 60 };
    return {
      blocks: [
        { kind: "single", step: { role: "WARMUP", intensity: "EASY", target: { type: "TIME", seconds: WARMUP_SECONDS } } },
        { kind: "single", step: { role: "STEADY", intensity: "MODERATE", target: tempoTarget } },
        { kind: "single", step: { role: "COOLDOWN", intensity: "EASY", target: { type: "TIME", seconds: COOLDOWN_SECONDS } } }
      ]
    };
  }

  // EASY / LONG_RUN / RECOVERY / RACE and anything else: one steady effort toward the target, so the
  // runner still gets a live progress bar and an end cue. Distance target preferred; else time; else
  // an open-ended run.
  const steadyTarget: StepTarget = distanceKm
    ? { type: "DISTANCE", meters: Math.round(distanceKm * 1000) }
    : durationMin
      ? { type: "TIME", seconds: durationMin * 60 }
      : { type: "OPEN" };
  const intensity: StepIntensity = type === "RACE" ? "HARD" : "EASY";
  return { blocks: [{ kind: "single", step: { role: "STEADY", intensity, target: steadyTarget } }] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------------------------
// Guided session library (audio-coaching plan, Phase C): sessions the runner picks directly —
// no plan or goal required. Each template builds a structure from a couple of adjustable
// parameters and names the workout type that selects its audio-coaching profile. Runs recorded
// this way save as normal (free) runs; the conservative matcher decides afterwards whether one
// counts toward a planned workout.
// ---------------------------------------------------------------------------------------------

export type GuidedSessionParam = {
  key: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

export type GuidedSessionTemplate = {
  id: "intervals" | "norwegian" | "strides" | "recovery" | "long_run";
  /** Selects the audio-coaching profile (profileForWorkoutType) and describes the session. */
  workoutType: string;
  params: GuidedSessionParam[];
  build: (params: Record<string, number>) => WorkoutStructure;
};

const num = (params: Record<string, number>, key: string, fallback: number) => {
  const value = params[key];
  return Number.isFinite(value) ? (value as number) : fallback;
};

export const GUIDED_SESSION_TEMPLATES: GuidedSessionTemplate[] = [
  {
    // Classic splits: hard reps with jog recovery.
    id: "intervals",
    workoutType: "INTERVAL",
    params: [
      { key: "reps", min: 4, max: 10, step: 1, default: 6 },
      { key: "repMeters", min: 200, max: 1000, step: 100, default: 400 }
    ],
    build: (params) => ({
      blocks: [
        { kind: "single", step: { role: "WARMUP", intensity: "EASY", target: { type: "TIME", seconds: WARMUP_SECONDS } } },
        {
          kind: "repeat",
          times: num(params, "reps", 6),
          steps: [
            { role: "WORK", intensity: "HARD", target: { type: "DISTANCE", meters: num(params, "repMeters", 400) } },
            { role: "RECOVERY", intensity: "EASY", target: { type: "TIME", seconds: 90 } }
          ]
        },
        { kind: "single", step: { role: "COOLDOWN", intensity: "EASY", target: { type: "TIME", seconds: COOLDOWN_SECONDS } } }
      ]
    })
  },
  {
    // Norwegian threshold: controlled work reps at "short sentences" effort, generous jog
    // recovery. The audio profile's whole job is stopping the runner from going too hard.
    id: "norwegian",
    workoutType: "THRESHOLD",
    params: [
      { key: "reps", min: 3, max: 5, step: 1, default: 4 },
      { key: "workMinutes", min: 3, max: 6, step: 1, default: 4 }
    ],
    build: (params) => ({
      blocks: [
        { kind: "single", step: { role: "WARMUP", intensity: "EASY", target: { type: "TIME", seconds: WARMUP_SECONDS } } },
        {
          kind: "repeat",
          times: num(params, "reps", 4),
          steps: [
            { role: "WORK", intensity: "HARD", target: { type: "TIME", seconds: num(params, "workMinutes", 4) * 60 } },
            { role: "RECOVERY", intensity: "EASY", target: { type: "TIME", seconds: 3 * 60 } }
          ]
        },
        { kind: "single", step: { role: "COOLDOWN", intensity: "EASY", target: { type: "TIME", seconds: COOLDOWN_SECONDS } } }
      ]
    })
  },
  {
    // Easy run finished with short relaxed pickups — form work, not a workout.
    id: "strides",
    workoutType: "STRIDES",
    params: [
      { key: "easyMinutes", min: 10, max: 40, step: 5, default: 20 },
      { key: "reps", min: 4, max: 8, step: 1, default: 6 }
    ],
    build: (params) => ({
      blocks: [
        { kind: "single", step: { role: "STEADY", intensity: "EASY", target: { type: "TIME", seconds: num(params, "easyMinutes", 20) * 60 } } },
        {
          kind: "repeat",
          times: num(params, "reps", 6),
          steps: [
            { role: "WORK", intensity: "HARD", target: { type: "TIME", seconds: 20 } },
            { role: "RECOVERY", intensity: "EASY", target: { type: "TIME", seconds: 60 } }
          ]
        },
        { kind: "single", step: { role: "COOLDOWN", intensity: "EASY", target: { type: "TIME", seconds: 5 * 60 } } }
      ]
    })
  },
  {
    // Low-pace recovery jog. The audio profile only ever says "slow down".
    id: "recovery",
    workoutType: "RECOVERY",
    params: [{ key: "durationMin", min: 20, max: 60, step: 5, default: 30 }],
    build: (params) => ({
      blocks: [{ kind: "single", step: { role: "STEADY", intensity: "EASY", target: { type: "TIME", seconds: num(params, "durationMin", 30) * 60 } } }]
    })
  },
  {
    // Long run by distance: splits, hydration and milestone company from the audio profile.
    id: "long_run",
    workoutType: "LONG_RUN",
    params: [{ key: "distanceKm", min: 6, max: 32, step: 1, default: 12 }],
    build: (params) => ({
      blocks: [{ kind: "single", step: { role: "STEADY", intensity: "EASY", target: { type: "DISTANCE", meters: num(params, "distanceKm", 12) * 1000 } } }]
    })
  }
];

/** Build a template's structure with params clamped to their declared bounds. */
export function buildGuidedSession(template: GuidedSessionTemplate, params: Record<string, number>): WorkoutStructure {
  const clamped: Record<string, number> = {};
  for (const param of template.params) {
    clamped[param.key] = clamp(num(params, param.key, param.default), param.min, param.max);
  }
  return template.build(clamped);
}

// --- Human-readable summaries (used on the pre-start card) ---

const ROLE_LABELS: Record<StepRole, Record<CoachLocale, string>> = {
  WARMUP: { en: "Warm-up", fr: "Échauffement", ar: "إحماء" },
  WORK: { en: "Work", fr: "Effort", ar: "مجهود" },
  RECOVERY: { en: "Recovery", fr: "Récupération", ar: "استشفاء" },
  STEADY: { en: "Steady", fr: "Rythme régulier", ar: "وتيرة ثابتة" },
  COOLDOWN: { en: "Cool-down", fr: "Retour au calme", ar: "تهدئة" }
};

const INTENSITY_LABELS: Record<StepIntensity, Record<CoachLocale, string>> = {
  EASY: { en: "Easy", fr: "Facile", ar: "سهل" },
  MODERATE: { en: "Moderate", fr: "Modéré", ar: "معتدل" },
  HARD: { en: "Hard", fr: "Intense", ar: "شديد" }
};

export function roleLabel(role: StepRole, locale: CoachLocale): string {
  return ROLE_LABELS[role][locale];
}

export function intensityLabel(intensity: StepIntensity, locale: CoachLocale): string {
  return INTENSITY_LABELS[intensity][locale];
}

// "400 m", "3:00", or "—" for an open step.
export function describeTarget(target: StepTarget, locale: CoachLocale): string {
  if (target.type === "DISTANCE") {
    return target.meters >= 1000 ? `${(target.meters / 1000).toFixed(target.meters % 1000 === 0 ? 0 : 1)} km` : `${target.meters} m`;
  }
  if (target.type === "TIME") {
    const m = Math.floor(target.seconds / 60);
    const s = target.seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return locale === "ar" ? "حر" : locale === "fr" ? "Libre" : "Open";
}

// Compact one-line summary, e.g. "Warm-up 10:00 · 6 × (400 m / 1:30) · Cool-down 10:00".
export function summarizeStructure(structure: WorkoutStructure, locale: CoachLocale): string {
  const parts = structure.blocks.map((block) => {
    if (block.kind === "single") {
      return `${roleLabel(block.step.role, locale)} ${describeTarget(block.step.target, locale)}`;
    }
    const inner = block.steps.map((step) => describeTarget(step.target, locale)).join(" / ");
    return `${block.times} × (${inner})`;
  });
  return parts.join(" · ");
}

// Rough total distance (km) if the whole structure were run at typical paces — only used to show an
// estimate on the card. Time steps are converted with a nominal easy pace so the number is sane.
export function estimateStructureDistanceKm(structure: WorkoutStructure): number {
  const NOMINAL_EASY_MPS = 2.6; // ~6:25 /km, a conservative easy pace for time→distance
  let meters = 0;
  const addStep = (step: WorkoutStep) => {
    if (step.target.type === "DISTANCE") meters += step.target.meters;
    else if (step.target.type === "TIME") meters += step.target.seconds * NOMINAL_EASY_MPS;
  };
  for (const block of structure.blocks) {
    if (block.kind === "single") addStep(block.step);
    else for (let i = 0; i < block.times; i += 1) block.steps.forEach(addStep);
  }
  return Math.round((meters / 1000) * 10) / 10;
}
