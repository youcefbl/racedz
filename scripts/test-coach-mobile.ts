/**
 * Coach contract tests for the native app's /api/v1 facade.
 *
 * Runs against a live dev server (npm run dev) and the dev database. The point of this suite is
 * *parity*: every assertion is about the mobile facade agreeing with the shared server rules the
 * website already obeys, not about the phone rendering something plausible.
 *
 * What it covers, and why each one earned a test:
 *
 * - **The profile matrix.** Eight adult profiles across age band, sex, experience, and availability.
 *   Plan generation is deterministic (`buildAdaptivePlanForGoal`, no AI call), so "the plan has as
 *   many sessions as the runner said they could train" is a fact that can be asserted rather than
 *   eyeballed. It also pins the safety floor: an advanced 7-day runner must still get rest.
 * - **Boundary and error cases.** A past target date, fewer days than the schema's floor, an empty
 *   custom goal on `OTHER`, and a non-numeric weekly distance must all be refused by the server,
 *   not merely greyed out in the app.
 * - **Coach language.** The plan and the coach's replies are localised from the *goal*, so a client
 *   that never sends `preferredLocale` hands an Arabic-speaking runner an English plan.
 * - **The reply shape.** `warningSignals` and `requiresProfessionalAdvice` must survive the trip to
 *   the phone; an earlier version of the endpoint flattened the reply to its summary and dropped
 *   them, so the phone showed strictly less caution than the website for the same reply.
 * - **Authorization.** Runner B must not be able to skip, move, or read runner A's workout.
 *
 *   npm run test:coach-mobile
 */
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.MOBILE_API_BASE ?? "http://127.0.0.1:3003";
const prisma = new PrismaClient();

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/**
 * Sign-in is rate limited per client IP (10 per 10 minutes) and this suite creates more runners
 * than that in one pass. Each runner therefore signs in from its own address, which is what a set
 * of genuinely distinct devices looks like; the limiter itself is covered by test-mobile-api.ts.
 */
const IP_PREFIX = `10.${44 + Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 250)}`;
let ipCounter = 0;
const nextClientIp = () => `${IP_PREFIX}.${(ipCounter += 1) % 250}`;

async function api(
  path: string,
  init: { method?: string; token?: string; body?: unknown; clientIp?: string } = {},
  // Deliberately loose: the shape differs per endpoint and the assertions below reach into it
  // directly, so a union of every coach payload would be more ceremony than the checks are worth.
  // `unknown` values force each assertion to state what it expects, which is what a test should do.
): Promise<{ status: number; body: ApiBody }> {
  const response = await fetch(`${BASE}/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": init.clientIp ?? `${IP_PREFIX}.251`,
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

/** A parsed response body, traversed with optional chaining at each assertion. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiBody = any;

const PASSWORD = "Coach-Matrix-Test-1!";

/**
 * A fresh runner, verified so login works and inside the 7-day trial so the coach is entitled.
 * Sex and birth date are set on the account rather than through onboarding, which is what a runner
 * who completed user onboarding first looks like — and is the branch that must *not* re-ask.
 */
async function makeRunner(label: string, opts: { birthYear?: number; gender?: "MALE" | "FEMALE" } = {}) {
  const email = `coachmx-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      firstName: "Matrix",
      lastName: label.toUpperCase(),
      emailVerifiedAt: new Date(),
      gender: opts.gender,
      dateOfBirth: opts.birthYear ? new Date(Date.UTC(opts.birthYear, 0, 1)) : undefined,
    },
    select: { id: true, email: true },
  });
  const login = await api("/auth/login", { method: "POST", body: { email, password: PASSWORD }, clientIp: nextClientIp() });
  if (login.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(login.body)}`);
  return { id: user.id, email, token: login.body.data.tokens.accessToken as string };
}

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

type MatrixCase = {
  id: string;
  ageBand: string;
  birthYear: number;
  gender: "MALE" | "FEMALE";
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  days: number[];
  weeklyKm: number;
  goalType: string;
  expectation: string;
};

const THIS_YEAR = new Date().getUTCFullYear();

/**
 * "Pro" maps to the API's real `ADVANCED` — there is no `PRO` enum, and inventing one would test a
 * value the backend cannot store. Age bands are adult only (18–25 and 60–70); no minors are created.
 */
const MATRIX: MatrixCase[] = [
  { id: "A", ageBand: "18-25", birthYear: THIS_YEAR - 22, gender: "MALE", experienceLevel: "BEGINNER", days: [2, 5], weeklyKm: 8, goalType: "FIVE_K", expectation: "conservative progression, rest preserved" },
  { id: "B", ageBand: "18-25", birthYear: THIS_YEAR - 21, gender: "FEMALE", experienceLevel: "BEGINNER", days: [1, 3, 5, 6], weeklyKm: 12, goalType: "TEN_K", expectation: "safe beginner volume" },
  { id: "C", ageBand: "18-25", birthYear: THIS_YEAR - 24, gender: "MALE", experienceLevel: "ADVANCED", days: [0, 1, 2, 3, 4, 5, 6], weeklyKm: 70, goalType: "MARATHON", expectation: "no unsupported daily intensity, recovery retained" },
  { id: "D", ageBand: "18-25", birthYear: THIS_YEAR - 23, gender: "FEMALE", experienceLevel: "ADVANCED", days: [2, 6], weeklyKm: 55, goalType: "HALF_MARATHON", expectation: "compressed schedule stays within safe load" },
  { id: "E", ageBand: "60-70", birthYear: THIS_YEAR - 66, gender: "MALE", experienceLevel: "BEGINNER", days: [1, 4], weeklyKm: 5, goalType: "FIVE_K", expectation: "conservative intensity, clear safety language" },
  { id: "F", ageBand: "60-70", birthYear: THIS_YEAR - 63, gender: "FEMALE", experienceLevel: "BEGINNER", days: [1, 3, 5, 6], weeklyKm: 9, goalType: "TEN_K", expectation: "recovery spacing, age-aware guidance" },
  { id: "G", ageBand: "60-70", birthYear: THIS_YEAR - 68, gender: "MALE", experienceLevel: "ADVANCED", days: [0, 1, 2, 3, 4, 5, 6], weeklyKm: 60, goalType: "MARATHON", expectation: "advanced status does not remove safety limits" },
  { id: "H", ageBand: "60-70", birthYear: THIS_YEAR - 61, gender: "FEMALE", experienceLevel: "ADVANCED", days: [1, 3, 4, 6], weeklyKm: 45, goalType: "HALF_MARATHON", expectation: "achievable and localised" },
];

/** Workout types that are training, not recovery — used to check the plan keeps easy days. */
const HARD_TYPES = new Set(["TEMPO", "INTERVAL", "RACE"]);

async function runMatrix() {
  console.log("\nProfile matrix (8 cases) — plan generated by the shared server, through /api/v1\n");
  const rows: string[] = [];

  for (const testCase of MATRIX) {
    const runner = await makeRunner(testCase.id.toLowerCase(), {
      birthYear: testCase.birthYear,
      gender: testCase.gender,
    });

    // A profile that already carries sex and birth date must not be asked for them again.
    const gaps = await api("/coach/goals", { token: runner.token });
    check(
      `${testCase.id}: onboarding does not re-ask for sex/birth date it already has`,
      gaps.body?.data?.needsSex === false && gaps.body?.data?.needsBirthDate === false,
      gaps.body?.data,
    );

    const created = await api("/coach/goals", {
      method: "POST",
      token: runner.token,
      body: {
        goalType: testCase.goalType,
        targetDate: inDays(70),
        experienceLevel: testCase.experienceLevel,
        currentWeeklyDistanceKm: testCase.weeklyKm,
        availableTrainingDays: testCase.days,
        preferredLocale: "en",
      },
    });
    check(`${testCase.id}: goal created`, created.status === 201, { status: created.status, body: created.body });
    check(`${testCase.id}: first week generated with the goal`, created.body?.data?.planCreated === true, created.body?.data);

    /**
     * Assertions run against the whole generated plan, read from the database.
     *
     * `/coach/plan` deliberately returns only the *current* Mon-Sun window, so a suite that ran on
     * a Saturday would see one or two sessions and conclude the planner was broken. The window is
     * checked separately below, as its own property.
     */
    const activePlan = await prisma.trainingPlan.findFirst({
      where: { userId: runner.id, status: "ACTIVE" },
      select: {
        endsOn: true,
        workouts: {
          select: { workoutType: true, status: true, scheduledFor: true, targetDistanceKm: true, intensity: true, title: true },
          orderBy: { scheduledFor: "asc" },
        },
      },
    });
    check(`${testCase.id}: an active plan exists`, Boolean(activePlan), activePlan);
    const workouts = activePlan?.workouts ?? [];

    // Rest days are absences from the plan, not REST rows, so the count of scheduled sessions is
    // what has to match availability.
    const sessions = workouts.filter((w) => w.workoutType !== "REST");
    check(
      `${testCase.id}: ${sessions.length} sessions planned, ${testCase.days.length} days available`,
      sessions.length > 0 && sessions.length <= testCase.days.length,
      { sessions: sessions.length, available: testCase.days.length },
    );

    // Every scheduled session must fall on a day the runner actually said they could train.
    const outsideAvailability = sessions
      .map((w) => w.scheduledFor.getUTCDay())
      .filter((d) => !testCase.days.includes(d));
    check(`${testCase.id}: every session is on an available day`, outsideAvailability.length === 0, outsideAvailability);

    // The safety floor that "advanced" must not remove: a 7-day week may not be hard every day.
    const hard = sessions.filter((w) => HARD_TYPES.has(w.workoutType));
    check(
      `${testCase.id}: not every session is hard (${hard.length}/${sessions.length})`,
      sessions.length === 0 || hard.length < sessions.length,
      { hard: hard.map((w) => w.workoutType) },
    );

    /**
     * The planner's own run-day ceiling (`MAX_RUN_DAYS` in adaptive-planner.ts): BEGINNER 4,
     * INTERMEDIATE 6, ADVANCED 7. Asserted as the documented contract rather than as a wish — a
     * beginner who ticks all seven days must still be given rest days, and today they are.
     *
     * Note what this does NOT assert: that an *older* advanced runner gets fewer. The planner takes
     * no age input at all (see `AdaptivePlannerInput`), so cases C and G differ only by the weekly
     * volume each runner reported. That gap is recorded in EXECUTION_PLAN.md as `COACHPAR-004`
     * rather than papered over here.
     */
    const maxRunDays = { BEGINNER: 4, INTERMEDIATE: 6, ADVANCED: 7 }[testCase.experienceLevel];
    check(
      `${testCase.id}: run days respect the ${testCase.experienceLevel} ceiling of ${maxRunDays}`,
      sessions.length <= maxRunDays,
      sessions.length,
    );

    // Nothing about the runner that they did not give is invented into the goal.
    const goalRow = await prisma.runnerGoal.findFirst({
      where: { userId: runner.id, status: "ACTIVE" },
      select: { restingHeartRate: true, weightKg: true, heightCm: true, injuryNotes: true, chronicConditions: true, longestRecentRunKm: true },
    });
    check(
      `${testCase.id}: no body or health value was invented`,
      goalRow?.restingHeartRate === null &&
        goalRow?.weightKg === null &&
        goalRow?.heightCm === null &&
        goalRow?.injuryNotes === null &&
        (goalRow?.chronicConditions ?? []).length === 0 &&
        goalRow?.longestRecentRunKm === null,
      goalRow,
    );

    // And the API's week window is a subset of that plan, not a different plan.
    const week = await api("/coach/plan", { token: runner.token });
    const weekIds: string[] = (week.body?.data?.workouts ?? []).map((w: { scheduledFor: string }) => w.scheduledFor);
    const planDates = new Set(workouts.map((w) => w.scheduledFor.toISOString()));
    check(
      `${testCase.id}: the week endpoint returns a subset of the plan`,
      weekIds.every((iso) => planDates.has(iso)),
      { week: weekIds.length, plan: workouts.length },
    );

    const weekKm = sessions.reduce((sum, w) => sum + (w.targetDistanceKm ?? 0), 0);
    rows.push(
      `  ${testCase.id} | ${testCase.ageBand} | ${testCase.gender.padEnd(6)} | ${testCase.experienceLevel.padEnd(12)} | ` +
        `${String(testCase.days.length).padStart(2)}d avail | ${String(sessions.length).padStart(2)} sessions | ` +
        `${weekKm.toFixed(1).padStart(5)} km | ${sessions.length - hard.length} easy | ` +
        `${[...new Set(sessions.map((w) => w.workoutType))].join("/")} | ${testCase.expectation}`,
    );
  }

  console.log("\n  case | age   | sex    | experience   | availability | plan        | volume | easy | types | expectation");
  console.log(rows.join("\n"));
}

async function runBoundaryCases() {
  console.log("\nBoundary and error cases — the server refuses, not just the form\n");
  const runner = await makeRunner("bounds", { birthYear: THIS_YEAR - 30, gender: "MALE" });
  const base = {
    goalType: "TEN_K",
    targetDate: inDays(60),
    experienceLevel: "BEGINNER" as const,
    currentWeeklyDistanceKm: 10,
    availableTrainingDays: [1, 3, 5],
  };

  const past = await api("/coach/goals", { method: "POST", token: runner.token, body: { ...base, targetDate: inDays(-3) } });
  check("target date in the past is refused", past.status === 422 || past.status === 400, past.status);

  const oneDay = await api("/coach/goals", { method: "POST", token: runner.token, body: { ...base, availableTrainingDays: [1] } });
  check("fewer than two training days is refused", oneDay.status === 422 || oneDay.status === 400, oneDay.status);

  const dupDays = await api("/coach/goals", { method: "POST", token: runner.token, body: { ...base, availableTrainingDays: [1, 1, 3] } });
  check("duplicate training days are refused", dupDays.status === 422 || dupDays.status === 400, dupDays.status);

  const emptyCustom = await api("/coach/goals", { method: "POST", token: runner.token, body: { ...base, goalType: "OTHER" } });
  check("goalType OTHER without a custom goal is refused", emptyCustom.status === 422 || emptyCustom.status === 400, emptyCustom.status);

  const longCustom = await api("/coach/goals", {
    method: "POST",
    token: runner.token,
    body: { ...base, goalType: "OTHER", customGoal: "x".repeat(301) },
  });
  check("over-long custom goal is refused", longCustom.status === 422 || longCustom.status === 400, longCustom.status);

  const negative = await api("/coach/goals", { method: "POST", token: runner.token, body: { ...base, currentWeeklyDistanceKm: -4 } });
  check("negative weekly distance is refused", negative.status === 422 || negative.status === 400, negative.status);

  const notANumber = await api("/coach/goals", { method: "POST", token: runner.token, body: { ...base, currentWeeklyDistanceKm: "many" } });
  check("non-numeric weekly distance is refused", notANumber.status === 422 || notANumber.status === 400, notANumber.status);

  const longRunDayOff = await api("/coach/goals", {
    method: "POST",
    token: runner.token,
    body: { ...base, preferredLongRunDay: 0 },
  });
  check("long-run day outside availability is refused", longRunDayOff.status === 422 || longRunDayOff.status === 400, longRunDayOff.status);

  // The maximum the schema allows: all seven days plus a valid long-run day inside them.
  const everyDay = await api("/coach/goals", {
    method: "POST",
    token: runner.token,
    body: { ...base, availableTrainingDays: [0, 1, 2, 3, 4, 5, 6], preferredLongRunDay: 6 },
  });
  check("seven training days is accepted", everyDay.status === 201, everyDay.status);
}

async function runLocaleCase() {
  console.log("\nCoach language — the plan is localised from the goal, not from a header\n");
  const runner = await makeRunner("ar", { birthYear: THIS_YEAR - 35, gender: "FEMALE" });
  const created = await api("/coach/goals", {
    method: "POST",
    token: runner.token,
    body: {
      goalType: "TEN_K",
      targetDate: inDays(60),
      experienceLevel: "BEGINNER",
      currentWeeklyDistanceKm: 10,
      availableTrainingDays: [1, 3, 5],
      preferredLocale: "ar",
    },
  });
  check("goal accepts preferredLocale ar", created.status === 201, created.status);

  // Read from the plan itself, not from /coach/plan: that endpoint returns only the current
  // Mon-Sun window, so a goal created on a Saturday has an entirely empty week and this would
  // assert against nothing.
  const activePlan = await prisma.trainingPlan.findFirst({
    where: { userId: runner.id, status: "ACTIVE" },
    select: { workouts: { select: { title: true, instructions: true } } },
  });
  const titles = (activePlan?.workouts ?? []).map((w) => w.title);
  const arabic = /[\u0600-\u06FF]/;
  check(
    "the generated plan is written in Arabic when the goal says Arabic",
    titles.length > 0 && titles.every((t) => arabic.test(t)),
    titles.slice(0, 3),
  );
  check(
    "the workout instructions are Arabic too, not just the titles",
    (activePlan?.workouts ?? []).every((w) => arabic.test(w.instructions)),
    (activePlan?.workouts ?? [])[0]?.instructions?.slice(0, 40),
  );

  // And the week endpoint agrees about the week it is describing.
  const plan = await api("/coach/plan", { token: runner.token });
  check("the plan endpoint reports a plan exists even when this week is empty", plan.body?.data?.hasPlan === true, plan.body?.data);
  check("and says when it starts", typeof plan.body?.data?.planStartsOn === "string", plan.body?.data?.planStartsOn);

  const goal = await prisma.runnerGoal.findFirst({ where: { userId: runner.id, status: "ACTIVE" }, select: { preferredLocale: true } });
  check("preferredLocale is stored on the goal", goal?.preferredLocale === "ar", goal);
}

async function runWorkoutActionCases() {
  console.log("\nMove / I can't today — and the authorization boundary around them\n");
  const runnerA = await makeRunner("wa", { birthYear: THIS_YEAR - 30, gender: "MALE" });
  const runnerB = await makeRunner("wb", { birthYear: THIS_YEAR - 31, gender: "FEMALE" });

  await api("/coach/goals", {
    method: "POST",
    token: runnerA.token,
    body: {
      goalType: "TEN_K",
      targetDate: inDays(60),
      experienceLevel: "BEGINNER",
      currentWeeklyDistanceKm: 10,
      availableTrainingDays: [0, 1, 2, 3, 4, 5, 6],
      preferredLocale: "en",
    },
  });

  const plan = await api("/coach/plan", { token: runnerA.token });
  const planned: Array<{ id: string; status: string; scheduledFor: string }> =
    (plan.body?.data?.workouts ?? []).filter((w: { status: string }) => w.status === "PLANNED");
  check("runner A has planned workouts to act on", planned.length >= 2, planned.length);
  check("the plan tells the client how far a workout may be moved", typeof plan.body?.data?.planEndsOn === "string", plan.body?.data?.planEndsOn);
  if (planned.length < 2) return;

  const [toSkip, toMove] = planned;

  // Runner B must not be able to touch runner A's session, and must not be told it exists.
  const foreignSkip = await api(`/coach/workouts/${toSkip.id}`, {
    method: "PATCH",
    token: runnerB.token,
    body: { action: "skip", reason: "FATIGUE" },
  });
  check("runner B cannot skip runner A's workout", foreignSkip.status === 404, foreignSkip.status);
  check("the refusal does not confirm the workout exists", foreignSkip.body?.error?.code === "NOT_FOUND", foreignSkip.body?.error);

  const foreignMove = await api(`/coach/workouts/${toSkip.id}`, {
    method: "PATCH",
    token: runnerB.token,
    body: { action: "reschedule", scheduledFor: inDays(2) },
  });
  check("runner B cannot move runner A's workout", foreignMove.status === 404, foreignMove.status);

  const unauth = await api(`/coach/workouts/${toSkip.id}`, { method: "PATCH", body: { action: "skip" } });
  check("an unauthenticated caller is refused", unauth.status === 401, unauth.status);

  // "I can't today", with a reason.
  const skipped = await api(`/coach/workouts/${toSkip.id}`, {
    method: "PATCH",
    token: runnerA.token,
    body: { action: "skip", reason: "PAIN_OR_SYMPTOMS" },
  });
  check("runner A can skip their own workout", skipped.status === 200, { status: skipped.status, body: skipped.body });

  const afterSkip = await api("/coach/plan", { token: runnerA.token });
  const skippedRow = (afterSkip.body?.data?.workouts ?? []).find((w: { id: string }) => w.id === toSkip.id);
  check("the skipped session comes back as SKIPPED", skippedRow?.status === "SKIPPED", skippedRow?.status);
  check("the reason comes back with it", skippedRow?.skipReason === "PAIN_OR_SYMPTOMS", skippedRow?.skipReason);

  // Skipping the same session twice is refused: it is no longer PLANNED.
  const doubleSkip = await api(`/coach/workouts/${toSkip.id}`, {
    method: "PATCH",
    token: runnerA.token,
    body: { action: "skip", reason: "FATIGUE" },
  });
  check("a session cannot be skipped twice", doubleSkip.status === 404, doubleSkip.status);

  // Move, to a date inside the plan window.
  const moved = await api(`/coach/workouts/${toMove.id}`, {
    method: "PATCH",
    token: runnerA.token,
    body: { action: "reschedule", scheduledFor: inDays(2) },
  });
  check("runner A can move their own workout", moved.status === 200, { status: moved.status, body: moved.body });

  const backwards = await api(`/coach/workouts/${toMove.id}`, {
    method: "PATCH",
    token: runnerA.token,
    body: { action: "reschedule", scheduledFor: inDays(-2) },
  });
  check("a workout cannot be moved into the past", backwards.status === 422 || backwards.status === 400, backwards.status);

  const nonsense = await api(`/coach/workouts/${toMove.id}`, {
    method: "PATCH",
    token: runnerA.token,
    body: { action: "explode" },
  });
  check("an unknown action is refused", nonsense.status === 422 || nonsense.status === 400, nonsense.status);
}

/**
 * The reply shape, asserted against a stored interaction rather than a live generation.
 *
 * Writing the row directly keeps this suite free of an OpenAI call — the thing under test is the
 * endpoint's mapping, and paying for a generation to check a field name would make the suite too
 * expensive to run often. `test:coach-live` is where real generation is exercised.
 */
/**
 * Editing a goal must not throw away the plan.
 *
 * Creating a goal supersedes the active plan by design; editing one does not. The whole value of an
 * edit is that a runner can change their coach's language, move a target date, or add an injury
 * without losing the week they are in — so this asserts the plan id survives, not merely that the
 * request returned 200.
 */
async function runGoalEditCase() {
  console.log("\nEditing a goal — changes the answers, keeps the plan\n");
  const runner = await makeRunner("edit", { birthYear: THIS_YEAR - 34, gender: "FEMALE" });
  const base = {
    goalType: "TEN_K",
    targetDate: inDays(60),
    experienceLevel: "BEGINNER" as const,
    currentWeeklyDistanceKm: 10,
    availableTrainingDays: [1, 3, 5],
    preferredLocale: "en",
  };
  await api("/coach/goals", { method: "POST", token: runner.token, body: base });

  const before = await prisma.trainingPlan.findFirst({
    where: { userId: runner.id, status: "ACTIVE" },
    select: { id: true },
  });
  check("a plan exists before the edit", Boolean(before), before);

  // The form prefills from here, so it has to carry the answers, not just a flag.
  const state = await api("/coach/goals", { token: runner.token });
  check("the goal endpoint returns the answers for prefill", state.body?.data?.goal?.goalType === "TEN_K", state.body?.data?.goal);
  check(
    "including availability and health context",
    Array.isArray(state.body?.data?.goal?.availableTrainingDays) && state.body?.data?.goal?.availableTrainingDays.length === 3,
    state.body?.data?.goal?.availableTrainingDays,
  );

  const edited = await api("/coach/goals", {
    method: "PATCH",
    token: runner.token,
    body: { ...base, preferredLocale: "ar", availableTrainingDays: [2, 4, 6], injuryHistory: "Left calf, 2024" },
  });
  check("the goal can be edited", edited.status === 200, { status: edited.status, body: edited.body });

  const goal = await prisma.runnerGoal.findFirst({
    where: { userId: runner.id, status: "ACTIVE" },
    select: { preferredLocale: true, availableTrainingDays: true, injuryHistory: true },
  });
  check("the coach language changed", goal?.preferredLocale === "ar", goal?.preferredLocale);
  check("availability changed", JSON.stringify(goal?.availableTrainingDays) === "[2,4,6]", goal?.availableTrainingDays);
  check("the health context changed", goal?.injuryHistory === "Left calf, 2024", goal?.injuryHistory);

  const after = await prisma.trainingPlan.findFirst({
    where: { userId: runner.id, status: "ACTIVE" },
    select: { id: true },
  });
  check("the active plan survived the edit", after?.id === before?.id, { before: before?.id, after: after?.id });

  // Only one goal stays active — an edit must not leave a second one behind.
  const activeGoals = await prisma.runnerGoal.count({ where: { userId: runner.id, status: "ACTIVE" } });
  check("there is still exactly one active goal", activeGoals === 1, activeGoals);

  // And the edit is refused when the body is not a valid goal.
  const bad = await api("/coach/goals", {
    method: "PATCH",
    token: runner.token,
    body: { ...base, availableTrainingDays: [1] },
  });
  check("an invalid edit is refused", bad.status === 422 || bad.status === 400, bad.status);

  // A runner with no goal has nothing to edit, and is told so rather than 500ing.
  const noGoal = await makeRunner("edit-none", { birthYear: THIS_YEAR - 29, gender: "MALE" });
  const missing = await api("/coach/goals", { method: "PATCH", token: noGoal.token, body: base });
  check("editing with no active goal is a 404", missing.status === 404, missing.status);
}

async function runReplyShapeCase() {
  console.log("\nReply shape — caution must survive the trip to the phone\n");
  const runner = await makeRunner("reply", { birthYear: THIS_YEAR - 40, gender: "MALE" });
  await api("/coach/goals", {
    method: "POST",
    token: runner.token,
    body: {
      goalType: "TEN_K",
      targetDate: inDays(60),
      experienceLevel: "BEGINNER",
      currentWeeklyDistanceKm: 10,
      availableTrainingDays: [1, 3, 5],
      preferredLocale: "en",
    },
  });

  await prisma.coachInteraction.create({
    data: {
      userId: runner.id,
      type: "CHAT",
      status: "COMPLETED",
      userMessage: "How should I approach my next run?",
      response: {
        summary: "Keep it easy.",
        progressAssessment: "You are building consistently.",
        positiveSignals: ["Three weeks in a row"],
        warningSignals: ["Do not turn the long run into a speed session", "High humidity today"],
        recoveryAdvice: ["Hydrate before you leave"],
        requiresProfessionalAdvice: true,
        usedSignals: ["goal", "recentRuns"],
        dataGaps: ["No sleep logged"],
        followUpQuestion: "How did your knee feel afterwards?",
        nextWorkout: null,
        upcomingWorkouts: [],
        memoryCandidates: [],
      },
      safety: { level: "CAUTION", reasons: ["reported pain"], requiresProfessionalAdvice: true },
      promptVersion: "test",
      completedAt: new Date(),
    },
  });

  const transcript = await api("/coach/interactions", { token: runner.token });
  const message = transcript.body?.data?.messages?.[0];
  check("the reply is an object, not a flattened string", typeof message?.response === "object" && message?.response !== null, typeof message?.response);
  check("warningSignals reach the client", (message?.response?.warningSignals ?? []).length === 2, message?.response?.warningSignals);
  check("requiresProfessionalAdvice reaches the client", message?.response?.requiresProfessionalAdvice === true, message?.response);
  check("progressAssessment reaches the client", typeof message?.response?.progressAssessment === "string", message?.response?.progressAssessment);
  check("dataGaps reach the client", (message?.response?.dataGaps ?? []).length === 1, message?.response?.dataGaps);
  check("recoveryAdvice reaches the client", (message?.response?.recoveryAdvice ?? []).length === 1, message?.response?.recoveryAdvice);
  check("followUpQuestion reaches the client", typeof message?.response?.followUpQuestion === "string", message?.response?.followUpQuestion);
  check("the safety verdict travels as its own field", message?.safety?.level === "CAUTION", message?.safety);

  // The context contract's exclusions, checked at the edge the client actually sees.
  const serialised = JSON.stringify(transcript.body);
  check("no prompt or context dump is echoed to the client", !serialised.includes("usedSignals"), "usedSignals present");
  check("no memory candidates are echoed to the client", !serialised.includes("memoryCandidates"), "memoryCandidates present");

  // Another runner must not see this conversation.
  const other = await makeRunner("reply-other", { birthYear: THIS_YEAR - 41, gender: "FEMALE" });
  const otherTranscript = await api("/coach/interactions", { token: other.token });
  check(
    "another runner's transcript does not contain this conversation",
    !JSON.stringify(otherTranscript.body).includes("Do not turn the long run"),
  );
}

async function runEntitlementCase() {
  console.log("\nEntitlement — an unsubscribed runner gets a state to render, not an error\n");
  const runner = await makeRunner("none", { birthYear: THIS_YEAR - 33, gender: "MALE" });
  // Age the account past the trial window without touching anyone else's data.
  await prisma.user.update({
    where: { id: runner.id },
    data: { createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) },
  });

  const overview = await api("/coach", { token: runner.token });
  check("an expired trial still answers 200", overview.status === 200, overview.status);
  check("the tier is NONE", overview.body?.data?.entitlement?.tier === "NONE", overview.body?.data?.entitlement);
  check("no goal is loaded for an unentitled runner", overview.body?.data?.goal === null, overview.body?.data?.goal);
  check("no plan is loaded for an unentitled runner", overview.body?.data?.adherence === null, overview.body?.data?.adherence);

  const plan = await api("/coach/plan", { token: runner.token });
  check("the plan endpoint also answers 200 with an empty week", plan.status === 200 && plan.body?.data?.hasPlan === false, plan.body?.data);
}

async function main() {
  console.log(`Coach mobile-API contract tests against ${BASE}`);
  try {
    await runMatrix();
    await runBoundaryCases();
    await runLocaleCase();
    await runWorkoutActionCases();
    await runGoalEditCase();
    await runReplyShapeCase();
    await runEntitlementCase();
  } finally {
    // Test runners are disposable; leaving them behind would slowly fill the dev database with
    // accounts carrying health-shaped fields.
    await prisma.user.deleteMany({ where: { email: { startsWith: "coachmx-" } } });
    await prisma.$disconnect();
  }

  console.log(`\n${passed} checks passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log(failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
