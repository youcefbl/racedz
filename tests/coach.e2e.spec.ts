import { expect, test } from "@playwright/test";

test("runner creates a goal, accepts a plan, logs a run, and receives coaching", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signInAsDemoRunner(page);
  await page.goto("/account/coach");
  await expect.poll(async () => getSessionEmail(page)).toBe("runner@example.com");

  const setupHeading = page.getByRole("heading", { name: "Create your running goal" });
  if (await setupHeading.isVisible().catch(() => false)) {
    await completeCoachGoalWizard(page);
  }

  await expect(page.getByRole("heading", { name: "Train with a clear next step" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("coach-desktop-overview.png"), fullPage: true });

  const coachViews = page.getByRole("navigation", { name: "Coach views" });
  await coachViews.getByRole("button", { name: "Plan", exact: true }).click();
  const generate = page.getByRole("button", { name: /Generate weekly plan|Prepare next week/ });
  if (await generate.isVisible().catch(() => false)) {
    await generate.click();
    await expect(page.getByText("Draft plan", { exact: true })).toBeVisible({ timeout: 60_000 });
  }

  const accept = page.getByRole("button", { name: "Accept plan" });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await expect(page.getByText("Active plan", { exact: true })).toBeVisible();
  }

  await coachViews.getByRole("button", { name: "Runs", exact: true }).click();
  const logRunForm = page.getByLabel("Distance (km)");
  if (!(await logRunForm.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Log a run" }).click();
  }
  await page.getByLabel("Distance (km)").fill("5");
  await page.getByLabel("Duration (minutes)").fill("31");
  await page.getByLabel("Description").fill("Comfortable evening run for the coach E2E check.");
  await page.getByRole("button", { name: "Save run" }).click();

  await expect(page.getByText("Run saved.", { exact: true })).toBeVisible();
  const providerFailure = page.getByText(/Run saved, but coach feedback failed:/);
  const coachHeading = page.getByRole("heading", { name: "Ask your coach" });
  await expect(providerFailure.or(coachHeading)).toBeVisible({ timeout: 60_000 });
  if (await providerFailure.isVisible().catch(() => false)) {
    testInfo.annotations.push({
      type: "provider",
      description: "Run persistence passed; live AI feedback was unavailable. Run with RACEDZ_REQUIRE_LIVE_AI=1 to require OpenAI success."
    });
    const latestRun = page.getByRole("article").first();
    await latestRun.getByRole("button", { name: "Details" }).click();
    await expect(latestRun).toContainText("Comfortable evening run for the coach E2E check.");
    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("coach-mobile-provider-failure.png"), fullPage: true });
    return;
  }

  await expect(coachHeading).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Post Run" }).first()).toBeVisible();

  await page.getByPlaceholder("How should I approach my next run?").fill("What should I focus on during my next easy run?");
  await page.getByRole("button", { name: "Ask coach" }).click();
  await expect(page.locator("article").filter({ hasText: "Chat" }).first()).toBeVisible({ timeout: 60_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("coach-mobile-conversation.png"), fullPage: true });
});

test("live OpenAI coach responds for an authenticated runner", async ({ page }) => {
  test.skip(process.env.RACEDZ_REQUIRE_LIVE_AI !== "1", "Set RACEDZ_REQUIRE_LIVE_AI=1 for the paid provider check.");
  await signInAsDemoRunner(page);

  const response = await page.request.post("/api/coach/interactions", {
    data: {
      type: "CHAT",
      message: "Give me one concise focus point for my next easy run."
    }
  });
  const body = (await response.json()) as { data?: { status?: string }; error?: string; code?: string };

  expect(response.status(), `OpenAI coach failed: ${body.code ?? body.error ?? "unknown error"}`).toBe(201);
  expect(body.data?.status).toBe("COMPLETED");
});

async function signInAsDemoRunner(page: import("@playwright/test").Page) {
  await page.context().clearCookies();

  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBeTruthy();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const signInResponse = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: "runner@example.com",
      password: "racedz-demo-password",
      callbackUrl: "/account/coach"
    }
  });

  expect(signInResponse.ok()).toBeTruthy();
}

async function completeCoachGoalWizard(page: import("@playwright/test").Page) {
  await page.locator("select").first().selectOption("TEN_K");
  await page.getByLabel("Target distance (km)").fill("10");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByLabel("Sex").selectOption("MALE");
  await page.getByLabel("Day", { exact: true }).selectOption("1");
  await page.getByLabel("Month", { exact: true }).selectOption("1");
  await page.getByLabel("Year", { exact: true }).selectOption(String(new Date().getFullYear() - 30));
  await page.getByLabel("Current weekly distance (km)").fill("15");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
}

async function getSessionEmail(page: import("@playwright/test").Page) {
  const response = await page.request.get("/api/auth/session");
  const session = (await response.json()) as { user?: { email?: string } };
  return session.user?.email ?? null;
}

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}
