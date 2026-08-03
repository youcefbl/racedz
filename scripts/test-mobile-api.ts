/**
 * Contract tests for the native app's /api/v1 facade.
 *
 * Runs against a live dev server (npm run dev) and the dev database. Covers the parts where a
 * mistake is a security bug rather than a cosmetic one: the auth envelope, refresh-token rotation
 * and reuse detection, security-stamp revocation, registration idempotency, and object-level
 * authorization on another user's registration and payment proof.
 *
 *   npm run test:mobile-api
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

type ApiResponse = { status: number; body: Record<string, unknown>; headers: Headers };

/**
 * Sign-in is rate limited per client IP (10 per 10 minutes), and this suite legitimately signs in
 * far more often than one real user would — every revocation check needs a fresh session. Each
 * phase therefore presents its own X-Forwarded-For, which is what genuinely distinct clients would
 * look like. The limiter is still exercised inside a phase, and `login rate limit trips` below
 * proves it works rather than assuming it.
 */
// Randomised per run so a second invocation within the limiter's 10-minute window starts with
// fresh buckets instead of inheriting the previous run's and failing on its own rate limit.
const RUN_OCTET = 1 + Math.floor(Math.random() * 250);
let currentClientIp = `203.0.${RUN_OCTET}.1`;

/** Switches the client IP subsequent requests present. Named away from a `use` prefix so the
 *  react-hooks lint rule does not mistake it for a React Hook. */
function actAsClient(ip: string) {
  currentClientIp = ip;
}

async function api(
  path: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<ApiResponse> {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "X-Forwarded-For": currentClientIp,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual"
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body, headers: response.headers };
}

function errorCode(response: ApiResponse): string {
  return (response.body.error as { code?: string } | undefined)?.code ?? "";
}

function tokensOf(response: ApiResponse): { accessToken: string; refreshToken: string } {
  const data = response.body.data as { tokens?: { accessToken: string; refreshToken: string } } | undefined;
  return data?.tokens ?? { accessToken: "", refreshToken: "" };
}

async function makeUser(password: string, options: { verified?: boolean } = {}) {
  const email = `mobile-test-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 4),
      firstName: "Mobile",
      lastName: "Tester",
      role: "RUNNER",
      emailVerifiedAt: options.verified === false ? null : new Date()
    },
    select: { id: true, email: true }
  });
  return user;
}

async function main() {
  console.log(`\nMobile /api/v1 contract tests against ${BASE}\n`);
  const createdUserIds: string[] = [];

  try {
    // ---- envelope + public reads -------------------------------------------------------------
    console.log("envelope and public reads");
    const config = await api("/api/v1/config");
    check("GET /config returns 200", config.status === 200, config.status);
    check("responses carry a request id", Boolean(config.headers.get("x-request-id")));
    check("responses are not cacheable", config.headers.get("cache-control") === "private, no-store");

    const races = await api("/api/v1/races?limit=2");
    const raceList = races.body.data as Array<Record<string, unknown>>;
    const meta = races.body.meta as Record<string, unknown>;
    check("GET /races returns a page", races.status === 200 && Array.isArray(raceList), races.status);
    check("GET /races honours limit", raceList.length <= 2, raceList.length);
    check("GET /races reports pagination meta", typeof meta?.total === "number" && typeof meta?.hasMore === "boolean");
    check(
      "GET /races caps page size at 50",
      ((await api("/api/v1/races?limit=9999")).body.meta as { limit: number }).limit === 50
    );

    const missing = await api("/api/v1/races/definitely-not-a-race");
    check("unknown race is a typed 404", missing.status === 404 && errorCode(missing) === "NOT_FOUND", missing.body);

    // ---- login -------------------------------------------------------------------------------
    console.log("\nlogin");
    actAsClient(`203.0.${RUN_OCTET}.10`);
    const password = `Test-${randomUUID()}`;
    const user = await makeUser(password);
    createdUserIds.push(user.id);

    const wrongPassword = await api("/api/v1/auth/login", {
      method: "POST",
      body: { email: user.email, password: "not-the-password" }
    });
    check(
      "wrong password is INVALID_CREDENTIALS",
      wrongPassword.status === 401 && errorCode(wrongPassword) === "INVALID_CREDENTIALS",
      wrongPassword.body
    );

    const unknownEmail = await api("/api/v1/auth/login", {
      method: "POST",
      body: { email: `nobody-${randomUUID()}@example.test`, password }
    });
    check(
      "unknown email gives the same answer as a wrong password (no enumeration)",
      JSON.stringify(unknownEmail.body) === JSON.stringify(wrongPassword.body),
      { unknownEmail: unknownEmail.body, wrongPassword: wrongPassword.body }
    );

    const unverified = await makeUser(password, { verified: false });
    createdUserIds.push(unverified.id);
    const unverifiedLogin = await api("/api/v1/auth/login", {
      method: "POST",
      body: { email: unverified.email, password }
    });
    check("an unverified account cannot sign in", unverifiedLogin.status === 401, unverifiedLogin.body);

    const login = await api("/api/v1/auth/login", {
      method: "POST",
      body: { email: user.email, password, deviceName: "Pixel 8", appVersion: "0.2.0" }
    });
    check("correct credentials return tokens", login.status === 200 && Boolean(tokensOf(login).accessToken), login.body);
    const loginUser = (login.body.data as { user?: Record<string, unknown> }).user ?? {};
    check("login response omits the password hash", !("passwordHash" in loginUser));
    check("login response omits the MFA secret", !("mfaSecret" in loginUser) && !("mfaBackupCodes" in loginUser));
    check("login response omits the security stamp", !("securityStampAt" in loginUser));

    let { accessToken, refreshToken } = tokensOf(login);

    // ---- authenticated reads ------------------------------------------------------------------
    console.log("\nauthenticated reads");
    const me = await api("/api/v1/me", { token: accessToken });
    check("GET /me works with the access token", me.status === 200, me.body);
    check("GET /me rejects a garbage token", (await api("/api/v1/me", { token: "not.a.token" })).status === 401);
    check(
      "GET /me rejects a tampered token payload",
      (await api("/api/v1/me", { token: `${accessToken.slice(0, -4)}AAAA` })).status === 401
    );

    // ---- refresh rotation and reuse -----------------------------------------------------------
    console.log("\nrefresh rotation");
    actAsClient(`203.0.${RUN_OCTET}.20`);
    const firstRefresh = await api("/api/v1/auth/refresh", { method: "POST", body: { refreshToken } });
    check("refresh returns a new pair", firstRefresh.status === 200 && Boolean(tokensOf(firstRefresh).refreshToken));
    check("the refresh token actually rotates", tokensOf(firstRefresh).refreshToken !== refreshToken);

    const reuse = await api("/api/v1/auth/refresh", { method: "POST", body: { refreshToken } });
    check(
      "replaying a rotated refresh token is detected",
      reuse.status === 401 && errorCode(reuse) === "REFRESH_REUSE_DETECTED",
      reuse.body
    );

    const afterReuse = await api("/api/v1/auth/refresh", {
      method: "POST",
      body: { refreshToken: tokensOf(firstRefresh).refreshToken }
    });
    check("reuse revokes the whole family, not just the replayed row", afterReuse.status === 401, afterReuse.body);

    // ---- security-stamp revocation ------------------------------------------------------------
    console.log("\nrevocation");
    actAsClient(`203.0.${RUN_OCTET}.30`);
    const second = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    accessToken = tokensOf(second).accessToken;
    refreshToken = tokensOf(second).refreshToken;
    check("can sign in again after a family revocation", second.status === 200, second.body);
    check("the fresh access token works", (await api("/api/v1/me", { token: accessToken })).status === 200);

    await prisma.user.update({ where: { id: user.id }, data: { securityStampAt: new Date() } });
    const afterStamp = await api("/api/v1/me", { token: accessToken });
    check(
      "bumping securityStampAt invalidates live access tokens",
      afterStamp.status === 401 && errorCode(afterStamp) === "SESSION_EXPIRED",
      afterStamp.body
    );

    const third = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    accessToken = tokensOf(third).accessToken;
    refreshToken = tokensOf(third).refreshToken;

    await prisma.user.update({ where: { id: user.id }, data: { blockedAt: new Date() } });
    const blocked = await api("/api/v1/me", { token: accessToken });
    check("a blocked account is rejected", blocked.status === 403 && errorCode(blocked) === "ACCOUNT_BLOCKED", blocked.body);
    const blockedRefresh = await api("/api/v1/auth/refresh", { method: "POST", body: { refreshToken } });
    check("a blocked account cannot refresh", blockedRefresh.status === 401, blockedRefresh.body);
    await prisma.user.update({ where: { id: user.id }, data: { blockedAt: null } });

    // A stolen refresh token must not outlive the password reset performed to lock the thief out.
    const stampVictim = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    const stolenRefresh = tokensOf(stampVictim).refreshToken;
    await prisma.user.update({ where: { id: user.id }, data: { securityStampAt: new Date() } });
    const refreshAfterStamp = await api("/api/v1/auth/refresh", { method: "POST", body: { refreshToken: stolenRefresh } });
    check(
      "bumping securityStampAt also invalidates the refresh token",
      refreshAfterStamp.status === 401,
      refreshAfterStamp.body
    );

    // ---- logout --------------------------------------------------------------------------------
    console.log("\nlogout");
    actAsClient(`203.0.${RUN_OCTET}.40`);
    const fourth = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    accessToken = tokensOf(fourth).accessToken;
    refreshToken = tokensOf(fourth).refreshToken;
    const loggedOut = await api("/api/v1/auth/logout", { method: "POST", body: { refreshToken } });
    check("logout succeeds", loggedOut.status === 200, loggedOut.body);

    // Access tokens are stateless, so without a session-liveness check a token captured before
    // logout would keep working for the rest of its 15 minutes.
    const meAfterLogout = await api("/api/v1/me", { token: accessToken });
    check(
      "the access token is dead immediately after logout",
      meAfterLogout.status === 401,
      meAfterLogout.body
    );

    const allDevices = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    const allDevicesToken = tokensOf(allDevices).accessToken;
    await api("/api/v1/auth/logout-all", { method: "POST", token: allDevicesToken });
    const meAfterLogoutAll = await api("/api/v1/me", { token: allDevicesToken });
    check(
      "the access token is dead immediately after sign-out-everywhere",
      meAfterLogoutAll.status === 401,
      meAfterLogoutAll.body
    );
    check(
      "the refresh token is dead after logout",
      (await api("/api/v1/auth/refresh", { method: "POST", body: { refreshToken } })).status === 401
    );
    check(
      "logout with an unknown token is still a success",
      (await api("/api/v1/auth/logout", { method: "POST", body: { refreshToken: "made-up-token-value-1234567890" } }))
        .status === 200
    );

    // ---- PKCE ----------------------------------------------------------------------------------
    console.log("\nPKCE browser flow");
    const anonymousAuthorize = await fetch(
      `${BASE}/api/v1/auth/authorize?code_challenge=${"a".repeat(43)}&code_challenge_method=S256&state=abcdefgh`,
      { redirect: "manual" }
    );
    check(
      "/authorize sends an unauthenticated browser to the web login",
      anonymousAuthorize.status === 307 || anonymousAuthorize.status === 302,
      anonymousAuthorize.status
    );
    check(
      "/authorize's login redirect returns to the authorize URL",
      (anonymousAuthorize.headers.get("location") ?? "").includes("callbackUrl=") &&
        decodeURIComponent(anonymousAuthorize.headers.get("location") ?? "").includes("/api/v1/auth/authorize")
    );

    const openRedirect = await fetch(
      `${BASE}/api/v1/auth/authorize?code_challenge=${"a".repeat(43)}&code_challenge_method=S256&state=abcdefgh&redirect_uri=https://evil.example`,
      { redirect: "manual" }
    );
    check("/authorize refuses an unregistered redirect_uri", openRedirect.status === 400, openRedirect.status);

    const badCode = await api("/api/v1/auth/token", {
      method: "POST",
      body: { code: "nope", codeVerifier: "b".repeat(43) }
    });
    check("/token rejects an unknown code", badCode.status === 400, badCode.body);

    // ---- registration + idempotency + authorization ---------------------------------------------
    console.log("\nregistration");
    actAsClient(`203.0.${RUN_OCTET}.50`);
    const openRace = await prisma.raceEvent.findFirst({
      where: { status: "PUBLISHED", registrationStatus: "OPEN", categories: { some: {} } },
      select: { id: true, categories: { select: { id: true }, take: 1 } }
    });

    if (!openRace) {
      console.log("  skip registration checks — no PUBLISHED race with OPEN registration in this database");
    } else {
      const fifth = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
      accessToken = tokensOf(fifth).accessToken;

      // Registering now requires a complete profile — the fields organisers ask for. Assert the
      // gate first, then satisfy it, so the rest of this section exercises registration itself.
      const beforeProfile = await api(`/api/v1/races/${openRace.id}/registrations`, {
        method: "POST",
        token: accessToken,
        body: { raceCategoryId: openRace.categories[0].id }
      });
      check(
        "registering without a complete profile is refused with a typed, actionable code",
        beforeProfile.status === 428 && errorCode(beforeProfile) === "PROFILE_INCOMPLETE",
        { status: beforeProfile.status, code: errorCode(beforeProfile) }
      );

      const filled = await api("/api/v1/me", {
        method: "PATCH",
        token: accessToken,
        body: { phone: "0555123456", gender: "MALE", dateOfBirth: "1995-05-12", wilaya: "Alger", city: "Algiers" }
      });
      check(
        "completing the profile flips the server-computed profileComplete flag",
        (filled.body.data as { profileComplete: boolean })?.profileComplete === true,
        filled.body
      );

      const registrationBody = {
        firstName: "Mobile",
        lastName: "Tester",
        phone: "0555000000",
        dateOfBirth: "1995-05-05",
        gender: "MALE",
        wilaya: "Alger",
        city: "Alger",
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "0555111111",
        raceCategoryId: openRace.categories[0].id,
        acceptedTerms: true
      };
      const key = randomUUID();

      const created = await api(`/api/v1/races/${openRace.id}/registrations`, {
        method: "POST",
        token: accessToken,
        body: registrationBody,
        headers: { "Idempotency-Key": key }
      });
      check("registration is created", created.status === 201, created.body);

      const replay = await api(`/api/v1/races/${openRace.id}/registrations`, {
        method: "POST",
        token: accessToken,
        body: registrationBody,
        headers: { "Idempotency-Key": key }
      });
      check("the same idempotency key replays the first result", replay.status === 201, replay.body);
      check("the replay is flagged", replay.headers.get("idempotent-replay") === "true");
      check(
        "the replay is the same registration, not a second one",
        (replay.body.data as { id?: string })?.id === (created.body.data as { id?: string })?.id
      );

      // Two identical taps racing each other must produce one registration, not two. Before the
      // reservation was inserted ahead of the mutation, both could pass a "no record yet" check.
      //
      // The earlier registration is removed first: leaving it would make every request in the burst
      // fail on the (userId, raceCategoryId) unique constraint, and the assertions below would pass
      // without the reservation ever being exercised.
      await prisma.notificationDelivery.deleteMany({ where: { notification: { userId: { in: createdUserIds } } } });
      await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.raceRegistration.deleteMany({ where: { userId: { in: createdUserIds } } });

      const raceKey = randomUUID();
      const concurrent = await Promise.all(
        [0, 1].map(() =>
          api(`/api/v1/races/${openRace.id}/registrations`, {
            method: "POST",
            token: accessToken,
            body: { ...registrationBody, raceCategoryId: openRace.categories[0].id },
            headers: { "Idempotency-Key": raceKey }
          })
        )
      );
      const created201 = concurrent.filter((response) => response.status === 201);
      const rejected = concurrent.filter((response) => response.status !== 201);
      const rowsAfterRace = await prisma.raceRegistration.count({ where: { userId: { in: createdUserIds } } });

      // Two outcomes are both correct, depending on how the requests interleave: the loser arrives
      // while the winner is mid-flight and is told CONFLICT, or it arrives after the winner
      // finished and gets the stored 201 back as a replay. Asserting one specific split would make
      // this test fail on timing rather than on behaviour, so assert the invariant instead — one
      // registration, one identity, and any second success flagged as a replay.
      check(
        "the race leaves exactly one registration in the database",
        rowsAfterRace === 1,
        rowsAfterRace
      );
      check(
        "at least one concurrent request succeeds",
        created201.length >= 1,
        concurrent.map((r) => ({ status: r.status, code: errorCode(r) }))
      );
      check(
        "every success refers to the same registration",
        new Set(created201.map((r) => (r.body.data as { id: string }).id)).size === 1,
        created201.map((r) => (r.body.data as { id: string }).id)
      );
      check(
        "any success beyond the first is marked as a replay",
        created201.filter((r) => r.headers.get("idempotent-replay") !== "true").length === 1,
        created201.map((r) => r.headers.get("idempotent-replay"))
      );
      check(
        "a loser that arrived mid-flight is told so rather than silently duplicating",
        rejected.every((r) => r.status === 409 && errorCode(r) === "CONFLICT"),
        rejected.map((r) => ({ status: r.status, code: errorCode(r) }))
      );
      // Distinguishes the reservation from the (userId, raceCategoryId) unique constraint, which
      // would also produce a 409 — but with a different message and, crucially, without the replay
      // below. Without the reservation the retry surfaces "already registered" as a failure.
      const replayAfterRace = await api(`/api/v1/races/${openRace.id}/registrations`, {
        method: "POST",
        token: accessToken,
        body: { ...registrationBody, raceCategoryId: openRace.categories[0].id },
        headers: { "Idempotency-Key": raceKey }
      });
      check(
        "a retry after the race replays the winner's 201 instead of failing as a duplicate",
        replayAfterRace.status === 201 && replayAfterRace.headers.get("idempotent-replay") === "true",
        { status: replayAfterRace.status, body: replayAfterRace.body }
      );

      const duplicate = await api(`/api/v1/races/${openRace.id}/registrations`, {
        method: "POST",
        token: accessToken,
        body: registrationBody,
        headers: { "Idempotency-Key": randomUUID() }
      });
      check(
        "a genuine duplicate registration is a 409",
        duplicate.status === 409 && errorCode(duplicate) === "CONFLICT",
        duplicate.body
      );

      // The reservation must SURVIVE a successful mutation. Deleting it — which the error path used
      // to do for any failure, including one raised after the transaction had already committed —
      // is what turns a retry into a spurious "you are already registered".
      const reservation = await prisma.mobileIdempotencyRecord.findFirst({
        where: { userId: { in: createdUserIds }, key: raceKey },
        select: { responseCode: true }
      });
      check(
        "a completed registration leaves its reservation stored, not released",
        reservation?.responseCode === 201,
        reservation
      );

      const registrationId = (created.body.data as { id: string }).id;
      const registrationDto = created.body.data as Record<string, unknown>;
      check("the registration DTO never exposes the proof path", !("paymentProofUrl" in registrationDto));

      // Object-level authorization: a second, unrelated account must not reach this registration.
      const otherPassword = `Test-${randomUUID()}`;
      const other = await makeUser(otherPassword);
      createdUserIds.push(other.id);
      const otherLogin = await api("/api/v1/auth/login", {
        method: "POST",
        body: { email: other.email, password: otherPassword }
      });
      const otherToken = tokensOf(otherLogin).accessToken;

      const stolenProof = await api(`/api/v1/registrations/${registrationId}/payment-proof`, { token: otherToken });
      check(
        "another user cannot read a registration's payment proof",
        stolenProof.status === 404,
        stolenProof.status
      );

      const otherRegistrations = await api("/api/v1/me/registrations", { token: otherToken });
      const otherRows = (otherRegistrations.body.data as Array<{ id: string }>) ?? [];
      check(
        "/me/registrations is scoped to the caller",
        !otherRows.some((row) => row.id === registrationId),
        otherRows.map((row) => row.id)
      );

      await prisma.raceRegistration.deleteMany({ where: { id: registrationId } });
    }

    // ---- profile edits ----------------------------------------------------------------------------
    console.log("\nprofile");
    actAsClient(`203.0.${RUN_OCTET}.60`);
    const profileLogin = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    const profileToken = tokensOf(profileLogin).accessToken;

    await api("/api/v1/me", { method: "PATCH", token: profileToken, body: { phone: "0555111222", city: "Oran" } });
    const cleared = await api("/api/v1/me", { method: "PATCH", token: profileToken, body: { phone: "", city: "" } });
    check(
      "an emptied optional field is actually cleared, not ignored",
      (cleared.body.data as { phone: string | null; city: string | null })?.phone === null &&
        (cleared.body.data as { city: string | null })?.city === null,
      cleared.body
    );

    const untouched = await api("/api/v1/me", { method: "PATCH", token: profileToken, body: { wilaya: "Alger" } });
    check(
      "omitting a field leaves it alone",
      (untouched.body.data as { wilaya: string | null })?.wilaya === "Alger",
      untouched.body
    );

    const blankName = await api("/api/v1/me", { method: "PATCH", token: profileToken, body: { firstName: "" } });
    check("a required name cannot be blanked", blankName.status === 422, blankName.body);

    // ---- filters ----------------------------------------------------------------------------------
    console.log("\nfilters");
    const badFilter = await api("/api/v1/races?type=NOT_A_REAL_TYPE");
    check(
      "an unknown race type filter is a validation error, not a 500",
      badFilter.status === 422 && errorCode(badFilter) === "VALIDATION_FAILED",
      { status: badFilter.status, body: badFilter.body }
    );
    check("a valid race type filter still works", (await api("/api/v1/races?type=TEN_K")).status === 200);

    // ---- runs sync -------------------------------------------------------------------------------
    console.log("\nruns sync");
    actAsClient(`203.0.${RUN_OCTET}.80`);
    const runsLogin = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    const runsToken = tokensOf(runsLogin).accessToken;

    const runClientId = randomUUID();
    const runBody = {
      clientId: runClientId,
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      distanceKm: 5.2,
      durationSeconds: 1800,
      perceivedEffort: 5,
      route: [
        { lat: 36.75, lng: 3.06 },
        { lat: 36.76, lng: 3.07 }
      ]
    };

    const savedRun = await api("/api/v1/runs", { method: "POST", token: runsToken, body: runBody });
    check("a run saves without a coaching goal", savedRun.status === 201, savedRun.body);
    const runDto = savedRun.body.data as Record<string, unknown>;
    check("the saved run carries a revision", runDto?.revision === 1, runDto?.revision);
    check("the saved run echoes its clientId", runDto?.clientId === runClientId);
    check("pace is server-computed, not client-supplied", typeof runDto?.averagePaceSecondsPerKm === "number");

    // The whole point of clientId: a phone that never saw the 201 retries the identical body.
    const replayedRun = await api("/api/v1/runs", { method: "POST", token: runsToken, body: runBody });
    check(
      "re-posting the same clientId returns the original run, not a second one",
      replayedRun.status === 200 && (replayedRun.body.data as { id: string }).id === runDto.id,
      { status: replayedRun.status, body: replayedRun.body }
    );
    check("the replay is flagged", replayedRun.headers.get("idempotent-replay") === "true");

    const runId = runDto.id as string;

    // Routes are only served per-run; a delta page carrying 50 of them would be enormous.
    const runDetail = await api(`/api/v1/runs/${runId}`, { token: runsToken });
    check("the single-run endpoint includes the route", Array.isArray((runDetail.body.data as { route: unknown }).route));
    const listForRoute = await api("/api/v1/runs", { token: runsToken });
    check(
      "the list endpoint omits routes",
      (listForRoute.body.data as Array<Record<string, unknown>>).every((r) => !("route" in r)),
      listForRoute.body
    );

    // Optimistic concurrency: the second of two edits from the same base must lose.
    const firstEdit = await api(`/api/v1/runs/${runId}`, {
      method: "PATCH",
      token: runsToken,
      body: { baseRevision: 1, title: "Morning run" }
    });
    check("an edit at the current revision succeeds", firstEdit.status === 200, firstEdit.body);
    check("the revision advances", (firstEdit.body.data as { revision: number }).revision === 2);

    const staleEdit = await api(`/api/v1/runs/${runId}`, {
      method: "PATCH",
      token: runsToken,
      body: { baseRevision: 1, title: "Written from a stale device" }
    });
    check(
      "an edit from a stale revision is refused, not silently applied",
      staleEdit.status === 409 && errorCode(staleEdit) === "CONFLICT",
      { status: staleEdit.status, code: errorCode(staleEdit) }
    );
    check(
      "the conflict carries the current server record so the client can reconcile",
      ((staleEdit.body.error as { details?: { run?: { title?: string } } })?.details?.run?.title) === "Morning run",
      staleEdit.body.error
    );

    // Delta sync must report the tombstone, or a delete never reaches the runner's other devices.
    const beforeDelete = await api("/api/v1/runs", { token: runsToken });
    const cursor = (beforeDelete.body.meta as { nextCursor: string }).nextCursor;
    check("the list issues a server-side cursor", typeof cursor === "string" && cursor.length > 0, cursor);

    const deleted = await api(`/api/v1/runs/${runId}`, { method: "DELETE", token: runsToken });
    check("deleting succeeds", deleted.status === 200, deleted.body);
    check("the deleted run is marked as a tombstone", (deleted.body.data as { deleted: boolean }).deleted === true);
    check("deleting again is not an error", (await api(`/api/v1/runs/${runId}`, { method: "DELETE", token: runsToken })).status === 200);

    const delta = await api(`/api/v1/runs?updatedSince=${encodeURIComponent(cursor)}`, { token: runsToken });
    const deltaItems = delta.body.data as Array<Record<string, unknown>>;
    check(
      "a delta sync reports the deletion to other devices",
      deltaItems.some((r) => r.id === runId && r.deleted === true),
      deltaItems
    );
    check(
      "a tombstone carries no route or notes",
      deltaItems.filter((r) => r.deleted).every((r) => !("route" in r) && !("notes" in r) && !("startedAt" in r)),
      deltaItems.filter((r) => r.deleted)
    );
    check("a deleted run is no longer readable", (await api(`/api/v1/runs/${runId}`, { token: runsToken })).status === 404);
    check(
      "the default list hides deleted runs",
      !((await api("/api/v1/runs", { token: runsToken })).body.data as Array<{ id: string }>).some((r) => r.id === runId)
    );

    // A route the size the recorder actually produces (1500 points) must be accepted. The first
    // draft of this endpoint inherited the shared 64 KB body cap and would have rejected it.
    const realisticRoute = Array.from({ length: 1500 }, (_, i) => ({
      lat: 36.75 + i * 0.00001,
      lng: 3.06 + i * 0.00001,
      elevation: 25 + (i % 40),
      timestamp: 1_760_000_000 + i
    }));
    const bigButValid = await api("/api/v1/runs", {
      method: "POST",
      token: runsToken,
      body: { ...runBody, clientId: randomUUID(), route: realisticRoute }
    });
    check("a full 1500-point recorded route is accepted", bigButValid.status === 201, {
      status: bigButValid.status,
      code: errorCode(bigButValid)
    });

    // Bounded payloads: refused outright rather than truncated, which would corrupt the distance.
    const hugeRoute = await api("/api/v1/runs", {
      method: "POST",
      token: runsToken,
      body: { ...runBody, clientId: randomUUID(), route: Array.from({ length: 5001 }, () => ({ lat: 36.75, lng: 3.06 })) }
    });
    check(
      "an oversized route is rejected rather than silently truncated",
      hugeRoute.status === 422 && errorCode(hugeRoute) === "VALIDATION_FAILED",
      { status: hugeRoute.status, code: errorCode(hugeRoute) }
    );

    // Measurements are server-computed; a client must not be able to rewrite them after the fact.
    const tamper = await api("/api/v1/runs", { method: "POST", token: runsToken, body: { ...runBody, clientId: randomUUID() } });
    const tamperId = (tamper.body.data as { id: string }).id;
    const tampered = await api(`/api/v1/runs/${tamperId}`, {
      method: "PATCH",
      token: runsToken,
      body: { baseRevision: 1, distanceKm: 42.2, title: "ok" }
    });
    const afterTamper = await api(`/api/v1/runs/${tamperId}`, { token: runsToken });
    check(
      "a client cannot rewrite a server-measured distance",
      (afterTamper.body.data as { distanceKm: number }).distanceKm === 5.2,
      { patch: tampered.status, distance: (afterTamper.body.data as { distanceKm: number }).distanceKm }
    );

    // Another runner's run must be invisible, not merely unlisted. A run carries GPS: the failure
    // mode here is one person learning where another lives.
    const stranger = await makeUser(password);
    createdUserIds.push(stranger.id);
    const strangerLogin = await api("/api/v1/auth/login", { method: "POST", body: { email: stranger.email, password } });
    const strangerToken = tokensOf(strangerLogin).accessToken;
    const otherRun = await api(`/api/v1/runs/${tamperId}`, { token: strangerToken });
    check("another runner cannot read this run", otherRun.status === 404, otherRun.status);
    check(
      "another runner's list does not contain it",
      !((await api("/api/v1/runs", { token: strangerToken })).body.data as Array<{ id: string }>).some((r) => r.id === tamperId)
    );

    // ---- rate limiting ----------------------------------------------------------------------------
    console.log("\nrate limiting");
    actAsClient(`203.0.${RUN_OCTET}.99`);
    let sawRateLimit = false;
    for (let attempt = 0; attempt < 14 && !sawRateLimit; attempt += 1) {
      const response = await api("/api/v1/auth/login", {
        method: "POST",
        body: { email: user.email, password: "wrong-on-purpose" }
      });
      sawRateLimit = response.status === 429 && errorCode(response) === "RATE_LIMITED";
    }
    // Proves the per-phase X-Forwarded-For above is a realistic separation of clients rather than a
    // way of quietly disabling a protection this suite depends on being there.
    check("repeated sign-in attempts from one IP are rate limited", sawRateLimit);

    // ---- preferences ------------------------------------------------------------------------------
    console.log("\npreferences");
    actAsClient(`203.0.${RUN_OCTET}.70`);
    const sixth = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    accessToken = tokensOf(sixth).accessToken;
    const prefs = await api("/api/v1/me/preferences", {
      method: "PATCH",
      token: accessToken,
      body: { theme: "race", language: "ar" }
    });
    check("preferences save", prefs.status === 200 && (prefs.body.data as { theme?: string }).theme === "race", prefs.body);
    check(
      "an unsupported theme is rejected",
      (await api("/api/v1/me/preferences", { method: "PATCH", token: accessToken, body: { theme: "neon" } })).status === 422
    );

    // ---- web handoff (DD6-R02) --------------------------------------------------------------------
    // The app→browser handoff is a sign-in primitive, so the negatives matter more than the happy
    // path: a link alone must never change auth state (GET is a pure peek), only a same-origin
    // confirmation POST may consume, tokens must not cross purpose doors, and a revoked mobile
    // session must kill its outstanding handoff links.
    console.log("\nweb handoff");
    actAsClient(`203.0.${RUN_OCTET}.71`);
    const seventh = await api("/api/v1/auth/login", { method: "POST", body: { email: user.email, password } });
    const handoffAccess = tokensOf(seventh).accessToken;

    const mint = await api("/api/v1/auth/web-handoff", {
      method: "POST",
      token: handoffAccess,
      body: { next: "/account/security" }
    });
    const handoffPath = (mint.body.data as { path?: string } | undefined)?.path ?? "";
    check(
      "mint returns a token-only path (destination stays server-side)",
      mint.status === 200 && handoffPath.startsWith("/auth/handoff?token=") && !handoffPath.includes("next="),
      mint.body
    );
    const handoffToken = new URL(`${BASE}${handoffPath}`).searchParams.get("token") ?? "";
    const mintedRow = await prisma.nativeAuthToken.findUnique({ where: { token: handoffToken } });
    check(
      "token row is purpose-, destination-, and session-bound",
      mintedRow?.purpose === "WEB_HANDOFF" &&
        mintedRow?.destination === "/account/security" &&
        Boolean(mintedRow?.mobileSessionFamilyId),
      mintedRow
    );

    const handoffForm = (token: string, headers: Record<string, string>) =>
      fetch(`${BASE}/auth/handoff`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": currentClientIp, ...headers },
        body: `token=${encodeURIComponent(token)}`
      });

    const peek = await fetch(`${BASE}${handoffPath}`, { redirect: "manual", headers: { "X-Forwarded-For": currentClientIp } });
    const peekHtml = await peek.text();
    check(
      "GET renders the confirmation page without the full email",
      peek.status === 200 &&
        peekHtml.includes('method="post"') &&
        peekHtml.includes("/account/security") &&
        !peekHtml.includes(user.email),
      { status: peek.status }
    );
    check("confirmation page is no-store", (peek.headers.get("cache-control") ?? "").includes("no-store"));
    const peekAgain = await fetch(`${BASE}${handoffPath}`, { redirect: "manual", headers: { "X-Forwarded-For": currentClientIp } });
    const afterPeeks = await prisma.nativeAuthToken.findUnique({ where: { token: handoffToken }, select: { usedAt: true } });
    check("peeking burns nothing (prefetch/link-scanner safe)", peekAgain.status === 200 && afterPeeks?.usedAt === null);

    const crossSite = await handoffForm(handoffToken, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" });
    const afterCross = await prisma.nativeAuthToken.findUnique({ where: { token: handoffToken }, select: { usedAt: true } });
    check(
      "a cross-site POST cannot consume (login CSRF blocked)",
      crossSite.status >= 300 && crossSite.status < 400 &&
        (crossSite.headers.get("location") ?? "").includes("/login") &&
        afterCross?.usedAt === null,
      { status: crossSite.status, location: crossSite.headers.get("location") }
    );

    const confirmed = await handoffForm(handoffToken, { Origin: BASE, "Sec-Fetch-Site": "same-origin" });
    const confirmedCookies = confirmed.headers.getSetCookie().join("; ");
    check(
      "a same-origin confirmation POST signs the browser in and lands on the bound destination",
      confirmed.status >= 300 && confirmed.status < 400 &&
        (confirmed.headers.get("location") ?? "").includes("/account/security") &&
        /authjs\.session-token/.test(confirmedCookies),
      { status: confirmed.status, location: confirmed.headers.get("location") }
    );

    const replayed = await handoffForm(handoffToken, { Origin: BASE, "Sec-Fetch-Site": "same-origin" });
    check(
      "a spent token is refused on replay",
      replayed.status >= 300 && replayed.status < 400 && (replayed.headers.get("location") ?? "").includes("/login"),
      { status: replayed.status, location: replayed.headers.get("location") }
    );

    // Purpose doors must not cross: a WebView-bridge token presented at the handoff door dies at
    // the peek, and is not consumed by the attempt.
    const bridgeToken = `${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
    await prisma.nativeAuthToken.create({
      data: { userId: user.id, token: bridgeToken, purpose: "WEBVIEW_BRIDGE", expiresAt: new Date(Date.now() + 300_000) }
    });
    const wrongDoor = await fetch(`${BASE}/auth/handoff?token=${bridgeToken}`, {
      redirect: "manual",
      headers: { "X-Forwarded-For": currentClientIp }
    });
    const bridgeAfter = await prisma.nativeAuthToken.findUnique({ where: { token: bridgeToken }, select: { usedAt: true } });
    check(
      "a WebView-bridge token is refused at the handoff door",
      wrongDoor.status >= 300 && wrongDoor.status < 400 &&
        (wrongDoor.headers.get("location") ?? "").includes("/login") &&
        bridgeAfter?.usedAt === null,
      { status: wrongDoor.status }
    );

    // An expired handoff token is refused at the peek.
    const expiredToken = `${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
    await prisma.nativeAuthToken.create({
      data: {
        userId: user.id,
        token: expiredToken,
        purpose: "WEB_HANDOFF",
        destination: "/account",
        expiresAt: new Date(Date.now() - 1_000)
      }
    });
    const expired = await fetch(`${BASE}/auth/handoff?token=${expiredToken}`, {
      redirect: "manual",
      headers: { "X-Forwarded-For": currentClientIp }
    });
    check("an expired token is refused", expired.status >= 300 && expired.status < 400 && (expired.headers.get("location") ?? "").includes("/login"));

    // Revoking the minting mobile session (stolen phone) kills its outstanding handoff links even
    // inside their 5-minute window.
    const mintForRevocation = await api("/api/v1/auth/web-handoff", {
      method: "POST",
      token: handoffAccess,
      body: { next: "/account" }
    });
    const revocationPath = (mintForRevocation.body.data as { path?: string } | undefined)?.path ?? "";
    const revocationToken = new URL(`${BASE}${revocationPath}`).searchParams.get("token") ?? "";
    const revocationRow = await prisma.nativeAuthToken.findUnique({ where: { token: revocationToken } });
    await prisma.mobileSession.updateMany({
      where: { familyId: revocationRow?.mobileSessionFamilyId ?? "" },
      data: { revokedAt: new Date() }
    });
    const afterRevocation = await handoffForm(revocationToken, { Origin: BASE, "Sec-Fetch-Site": "same-origin" });
    const revokedTokenState = await prisma.nativeAuthToken.findUnique({
      where: { token: revocationToken },
      select: { usedAt: true }
    });
    check(
      "a revoked mobile session kills its outstanding handoff link",
      afterRevocation.status >= 300 && afterRevocation.status < 400 &&
        (afterRevocation.headers.get("location") ?? "").includes("/login") &&
        revokedTokenState?.usedAt === null,
      { status: afterRevocation.status, location: afterRevocation.headers.get("location") }
    );
  } finally {
    // Registering fires a notification, and Notification.userId has no cascade — clear the rows
    // that block the user delete before removing the test accounts.
    await prisma.nativeAuthToken.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.mobileIdempotencyRecord.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.notificationDelivery.deleteMany({
      where: { notification: { userId: { in: createdUserIds } } }
    });
    await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.raceRegistration.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.map((name) => `  - ${name}`).join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
