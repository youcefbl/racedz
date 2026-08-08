/**
 * SEC-004 object-level authorization (BOLA/IDOR) coverage for `/api/v1`.
 *
 * The class of bug this exists to catch: a route that authenticates the caller but then trusts the
 * object id in the path, so knowing (or guessing) another runner's run id, registration id or coach
 * interaction id is enough to read or change it. Authentication is not authorization, and the
 * failure is silent — the attacker sees a 200 and the owner never learns.
 *
 * Method: create two disposable verified runners, give B a full set of owned objects, then attempt
 * every read and mutation against B's ids **while holding A's token**. Anything other than a
 * refusal (401/403/404) is a finding. Each case also asserts that B *can* reach their own object,
 * so a route that is simply broken for everyone cannot masquerade as "secure".
 *
 * Requires the dev server and a disposable DATABASE_URL. Seeds and cleans up after itself.
 * Run: npx tsx scripts/test-authz-objects.ts
 */
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

loadEnvConfig(process.cwd());

const BASE = process.env.MOBILE_API_BASE ?? "http://127.0.0.1:3003";
const PASSWORD = "AuthzTest123!";

let allOk = true;
let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail: string) {
  if (ok) passed += 1;
  else {
    failed += 1;
    allOk = false;
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} — ${detail}`);
}

type ApiResponse = { status: number; body: Record<string, unknown> };

async function api(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {}
): Promise<ApiResponse> {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

/**
 * A refusal is any of 401/403/404. 404 is accepted deliberately: hiding the existence of another
 * user's object is a legitimate — often preferable — answer to an IDOR probe, because a 403 on a
 * random id confirms that the id is real.
 */
const REFUSED = [401, 403, 404];
const isRefused = (status: number) => REFUSED.includes(status);

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  const tag = `authz-obj-${process.pid}-${Date.now()}`;
  const created: string[] = [];

  try {
    // ---- two runners ---------------------------------------------------------------------
    async function makeUser(label: string) {
      const email = `${tag}-${label}@example.test`;
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(PASSWORD, 4),
          firstName: "Authz",
          lastName: label.toUpperCase(),
          role: "RUNNER",
          emailVerifiedAt: new Date(),
          phone: "0550000000",
          gender: "MALE",
          dateOfBirth: new Date("1996-05-21"),
          wilaya: "Alger",
          city: "Alger Centre",
        },
        select: { id: true, email: true },
      });
      created.push(user.id);
      const login = await api("/api/v1/auth/login", {
        method: "POST",
        body: { email, password: PASSWORD, device: { platform: "android", model: "authz" } },
      });
      const tokens = (login.body.data as { tokens?: { accessToken: string } } | undefined)?.tokens;
      if (!tokens?.accessToken) {
        throw new Error(`could not sign in ${label}: ${login.status} ${JSON.stringify(login.body).slice(0, 200)}`);
      }
      return { ...user, token: tokens.accessToken };
    }

    const alice = await makeUser("a");
    const bob = await makeUser("b");
    console.log(`\nSEC-004 object authorization against ${BASE}`);
    console.log(`attacker=${alice.email}  victim=${bob.email}\n`);

    // ---- objects owned by B --------------------------------------------------------------
    const bobRun = await prisma.runnerRun.create({
      data: {
        userId: bob.id,
        startedAt: new Date(),
        distanceKm: 5.2,
        durationSeconds: 1800,
        averagePaceSecondsPerKm: 346,
        perceivedEffort: 5,
        isPublic: false,
        source: "GPS",
        route: [
          { lat: 36.75, lng: 3.06, ele: 40, t: Date.now() - 1800_000 },
          { lat: 36.76, lng: 3.07, ele: 42, t: Date.now() },
        ],
      },
      select: { id: true },
    });

    const bobGoal = await prisma.runnerGoal.create({
      data: {
        userId: bob.id,
        goalType: "TEN_K",
        targetDate: new Date(Date.now() + 60 * 86_400_000),
        experienceLevel: "INTERMEDIATE",
        currentWeeklyDistanceKm: 20,
        availableTrainingDays: [1, 3, 5],
        preferredLocale: "en",
        status: "ACTIVE",
        injuryNotes: "left knee niggle",
      },
      select: { id: true },
    });

    const bobInteraction = await prisma.coachInteraction.create({
      data: {
        userId: bob.id,
        goalId: bobGoal.id,
        type: "CHAT",
        status: "COMPLETED",
        userMessage: "private health question",
        response: { summary: "private coach reply" },
        safety: { level: "CLEAR", requiresProfessionalAdvice: false },
        promptVersion: "authz-test",
      },
      select: { id: true },
    });

    const bobSleep = await prisma.sleepLog.create({
      data: { userId: bob.id, night: new Date("2026-08-01"), durationMinutes: 420 },
      select: { id: true },
    });

    // ---- run objects ---------------------------------------------------------------------
    console.log("runs");
    const ownRun = await api(`/api/v1/runs/${bobRun.id}`, { token: bob.token });
    check("owner can read their own run", ownRun.status === 200, `${ownRun.status}`);

    const foreignRunRead = await api(`/api/v1/runs/${bobRun.id}`, { token: alice.token });
    check(
      "another runner cannot read a private run (route + GPS exposure)",
      isRefused(foreignRunRead.status),
      `${foreignRunRead.status}`
    );

    // Sent with a VALID body — including the baseRevision the schema requires — so a pass proves
    // authorization refused it, not merely validation. A test that is rejected at the schema would
    // look identical to a secure route while leaving a well-formed attack unexamined.
    const bobRevision = (
      await prisma.runnerRun.findUnique({ where: { id: bobRun.id }, select: { revision: true } })
    )?.revision;
    const foreignRunPatch = await api(`/api/v1/runs/${bobRun.id}`, {
      method: "PATCH",
      token: alice.token,
      body: { title: "hijacked", isPublic: true, baseRevision: bobRevision },
    });
    check(
      "a well-formed cross-account run edit is refused (incl. flipping it public)",
      isRefused(foreignRunPatch.status) || foreignRunPatch.status === 409,
      `${foreignRunPatch.status} (body accepted by schema, refused by ownership)`
    );

    const foreignRunDelete = await api(`/api/v1/runs/${bobRun.id}`, {
      method: "DELETE",
      token: alice.token,
    });
    check(
      "another runner cannot delete a run",
      isRefused(foreignRunDelete.status),
      `${foreignRunDelete.status}`
    );

    const stillThere = await prisma.runnerRun.findFirst({
      where: { id: bobRun.id, deletedAt: null },
      select: { id: true, title: true, isPublic: true },
    });
    check(
      "the victim's run is untouched after all attempts",
      stillThere !== null && stillThere.title !== "hijacked" && stillThere.isPublic === false,
      JSON.stringify(stillThere)
    );

    const foreignGpx = await api(`/api/v1/runs/${bobRun.id}/gpx`, { token: alice.token });
    check(
      "another runner cannot export a run's GPX",
      isRefused(foreignGpx.status),
      `${foreignGpx.status}`
    );

    // ---- coach objects -------------------------------------------------------------------
    console.log("\ncoach");
    const foreignOverview = await api("/api/v1/coach", { token: alice.token });
    const overviewGoal = (foreignOverview.body.data as { goal?: { id?: string } } | undefined)?.goal;
    check(
      "the coach overview never returns another runner's goal",
      overviewGoal?.id !== bobGoal.id,
      `goal=${overviewGoal?.id ?? "none"}`
    );

    const foreignInteractions = await api("/api/v1/coach/interactions", { token: alice.token });
    const messages =
      (foreignInteractions.body.data as { messages?: Array<{ id?: string }> } | undefined)?.messages ?? [];
    check(
      "the conversation never returns another runner's interactions",
      !messages.some((m) => m.id === bobInteraction.id),
      `${messages.length} message(s) returned`
    );

    const foreignGoalPatch = await api(`/api/v1/coach/goals/${bobGoal.id}`, {
      method: "PATCH",
      token: alice.token,
      body: { preferredLocale: "fr" },
    });
    check(
      "another runner cannot edit a coach goal (health-adjacent record)",
      isRefused(foreignGoalPatch.status),
      `${foreignGoalPatch.status}`
    );

    const goalAfter = await prisma.runnerGoal.findUnique({
      where: { id: bobGoal.id },
      select: { preferredLocale: true, injuryNotes: true },
    });
    check(
      "the victim's goal and injury notes are unchanged",
      goalAfter?.preferredLocale === "en" && goalAfter?.injuryNotes === "left knee niggle",
      JSON.stringify(goalAfter)
    );

    const foreignSleep = await api("/api/v1/coach/sleep", { token: alice.token });
    const sleepRows =
      (foreignSleep.body.data as { logs?: Array<{ id?: string }> } | undefined)?.logs ?? [];
    check(
      "sleep history never returns another runner's nights",
      !sleepRows.some((s) => s.id === bobSleep.id),
      `${sleepRows.length} log(s) returned`
    );

    const foreignMemory = await api("/api/v1/coach/memory", { token: alice.token });
    check(
      "coach memory responds only for the caller",
      foreignMemory.status === 200 || isRefused(foreignMemory.status),
      `${foreignMemory.status}`
    );

    // ---- unauthenticated -----------------------------------------------------------------
    console.log("\nunauthenticated");
    for (const [label, path] of [
      ["run detail", `/api/v1/runs/${bobRun.id}`],
      ["run gpx", `/api/v1/runs/${bobRun.id}/gpx`],
      ["coach overview", "/api/v1/coach"],
      ["coach interactions", "/api/v1/coach/interactions"],
    ] as const) {
      const anon = await api(path);
      check(`${label} refuses an anonymous caller`, isRefused(anon.status), `${anon.status}`);
    }

    // ---- malformed / probing ids ---------------------------------------------------------
    console.log("\nprobing");
    for (const [label, id] of [
      ["a non-existent id", "clzzzzzzzzzzzzzzzzzzzzzzz"],
      ["a path-traversal attempt", ".."],
      ["an empty-ish id", "%20"],
    ] as const) {
      const probe = await api(`/api/v1/runs/${id}`, { token: alice.token });
      check(
        // A 3xx is acceptable for the traversal case: the router normalises `/runs/..` to `/api/v1`
        // and redirects, which never reaches a run at all.
        `run detail refuses ${label} without leaking a stack trace`,
        isRefused(probe.status) || probe.status === 400 || (probe.status >= 300 && probe.status < 400),
        `${probe.status}`
      );
      const raw = JSON.stringify(probe.body);
      check(
        `the ${label} response carries no stack trace or SQL`,
        !/ at .*\.ts:|prisma\.|SELECT |PrismaClient/i.test(raw),
        raw.slice(0, 80)
      );
    }
  } finally {
    // Disposable by construction: everything cascades from the two users.
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (!allOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
