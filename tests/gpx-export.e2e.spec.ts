import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { expect, test } from "@playwright/test";
import { getPrisma } from "../src/lib/db";

const prisma = getPrisma();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("a GPS run downloads GPX and explains export failures", async ({ page }) => {
  const userId = `gpx-${randomUUID()}`;
  const email = `${userId}@example.test`;
  const password = "gpx-export-test-password";
  const now = new Date();
  await prisma.user.create({
    data: {
      id: userId,
      email,
      passwordHash: await hash(password, 4),
      firstName: "GPX",
      lastName: "Runner",
      emailVerifiedAt: now,
      onboardedAt: now
    }
  });
  await prisma.runnerGoal.create({
    data: {
      id: `goal-${randomUUID()}`,
      userId,
      goalType: "TEN_K",
      targetDate: new Date(now.getTime() + 30 * 86_400_000),
      targetDistanceKm: 10,
      experienceLevel: "BEGINNER",
      currentWeeklyDistanceKm: 10,
      availableTrainingDays: [1, 3, 6],
      preferredLocale: "en",
      status: "ACTIVE"
    }
  });
  await signIn(page, email, password);

  const startedAt = Date.now() - 60 * 60_000;
  const route = Array.from({ length: 21 }, (_, index) => ({
    lat: 36.75 + index * 0.00009,
    lng: 3.05,
    ele: 20,
    t: startedAt + index * 6_000
  }));
  try {
    const createResponse = await page.request.post("/api/coach/runs", {
      data: {
        startedAt: new Date(startedAt).toISOString(),
        distanceKm: 0.2,
        durationSeconds: 120,
        movingTimeSeconds: 120,
        source: "GPS",
        isPublic: false,
        route,
        perceivedEffort: 3,
        title: "GPX export E2E"
      }
    });
    const created = (await createResponse.json()) as { data: { run: { id: string } }; error?: string; code?: string };
    expect(createResponse.status(), `${created.code ?? "RUN_CREATE_FAILED"}: ${created.error ?? "Unknown error"}`).toBe(201);
    const runId = created.data.run.id;

    await page.goto("/account/runs");
    const card = page.getByRole("article").filter({ hasText: "GPX export E2E" });
    await expect(card).toBeVisible();
    const details = card.getByRole("button", { name: "Details" });
    if ((await details.getAttribute("aria-expanded")) !== "true") await details.click();

    await page.route(
      `**/api/coach/runs/${runId}/gpx`,
      async (intercepted) => {
        const response = await intercepted.fetch();
        await new Promise((resolve) => setTimeout(resolve, 250));
        await intercepted.fulfill({ response });
      },
      { times: 1 }
    );
    const downloadPromise = page.waitForEvent("download");
    await card.getByRole("button", { name: "GPX", exact: true }).click();
    await expect(card.getByRole("button", { name: "Preparing GPX…" })).toBeDisabled();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^zidrun-\d{4}-\d{2}-\d{2}-[a-z0-9]{6}\.gpx$/);
    await expect(page.getByText("GPX download started.", { exact: true })).toBeVisible();

    await page.route(`**/api/coach/runs/${runId}/gpx`, (intercepted) =>
      intercepted.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "Test export blocked." }) })
    );
    await card.getByRole("button", { name: "GPX", exact: true }).click();
    await expect(page.getByText("GPX wasn't exported: Test export blocked.", { exact: true })).toBeVisible();
  } finally {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
});

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.context().clearCookies();
  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBeTruthy();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const signInResponse = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: "/account/runs"
    }
  });
  expect(signInResponse.ok()).toBeTruthy();
}
