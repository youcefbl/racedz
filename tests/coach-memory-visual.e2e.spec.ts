import { expect, test } from "@playwright/test";
import { getUserByEmail, markUserOnboarded, ensureCoachSubscription, ensureCoachGoal, seedCoachMemory, clearCoachMemory, closeDb } from "./db";

// Visual verification for the coaching-memory screen (Phase 3). Seeds a spread of facts across the
// four sources and a range of ages (including one aging out), then screenshots the panel across the
// three themes plus Arabic RTL and a mobile width, so the source-chip encoding, hierarchy, and RTL
// layout can be reviewed. Not a strict assertion test — it exists to produce the screenshots.

const SEED = [
  { kind: "SCHEDULE", key: "preferred_time", value: "Can only run early mornings before work", source: "RUNNER_STATED", ageDays: 12 },
  { kind: "TERRAIN", key: "available_terrain", value: "Only has a flat coastal road — no hills or track nearby", source: "RUNNER_STATED", ageDays: 30 },
  { kind: "PREFERENCE", key: "trails", value: "Prefers trails to roads when there's a choice", source: "AI_INFERRED", confidence: 0.7, ageDays: 8 },
  { kind: "CONSTRAINT", key: "night_shift", value: "Works a night shift every second Thursday", source: "RUNNER_STATED", ageDays: 60 },
  { kind: "REJECTED_SUGGESTION", key: "club", value: "Declined joining a running club — prefers training alone", source: "SYSTEM_DERIVED", ageDays: 20 },
  { kind: "COMMITMENT", key: "race_signup", value: "Committed to entering the Algiers half marathon in September", source: "AI_INFERRED", confidence: 0.6, ageDays: 130 }
];

test.afterAll(async () => {
  const user = await getUserByEmail("runner@example.com");
  if (user) await clearCoachMemory(user.id);
  await closeDb();
});

async function signIn(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  const csrf = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: "runner@example.com", password: "racedz-demo-password", callbackUrl: "/account/coach" }
  });
  expect(res.ok()).toBeTruthy();
}

async function setTheme(page: import("@playwright/test").Page, theme: string) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-theme", value);
  }, theme);
}

async function openMemory(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /Memory|Mémoire|الذاكرة/ }).first().click();
  await expect(page.getByRole("heading", { name: /What your coach remembers|Ce que votre coach retient|ما يتذكره مدربك/ })).toBeVisible();
  // Wait past the loading skeleton for the real facts to land, so screenshots show the loaded state.
  await expect(page.getByRole("listitem").first()).toBeVisible({ timeout: 15_000 });
}

test("coach memory screen renders across themes and RTL", async ({ page }, testInfo) => {
  await signIn(page);
  const user = await getUserByEmail("runner@example.com");
  expect(user, "demo runner must exist in the test DB").toBeTruthy();
  await markUserOnboarded("runner@example.com");
  await ensureCoachSubscription(user!.id);
  await ensureCoachGoal(user!.id);
  await seedCoachMemory(user!.id, SEED);

  // Desktop, three themes.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/account/coach");

  // Skip cleanly if this account has no coach goal yet (the panel lives behind the goal gate).
  const hasGoal = await page.getByRole("button", { name: /Memory|Mémoire|الذاكرة/ }).first().isVisible().catch(() => false);
  test.skip(!hasGoal, "runner@example.com has no coach goal in this DB; seed one to capture screenshots");

  for (const theme of ["light", "dark", "race"] as const) {
    await page.goto("/account/coach");
    await setTheme(page, theme);
    await openMemory(page);
    await page.screenshot({ path: testInfo.outputPath(`memory-desktop-${theme}.png`), fullPage: true });
  }

  // Delete-confirm state (light).
  await page.goto("/account/coach");
  await setTheme(page, "light");
  await openMemory(page);
  await page.getByRole("button", { name: /^Delete all$/ }).click();
  await expect(page.getByText(/Delete everything your coach remembers\?/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("memory-delete-confirm.png"), fullPage: true });

  // Mobile.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/account/coach");
  await setTheme(page, "light");
  await openMemory(page);
  await page.screenshot({ path: testInfo.outputPath("memory-mobile.png"), fullPage: true });

  // Arabic RTL — the panel follows the app UI locale (?lang), not the coach-response language.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/account/coach?lang=ar");
  await setTheme(page, "light");
  await openMemory(page);
  await expect(page.locator("section[dir='rtl']").first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("memory-rtl-arabic.png"), fullPage: true });
});
