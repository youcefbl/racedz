import { expect, test } from "@playwright/test";
import {
  DEMO,
  DEMO_PASSWORD,
  getSessionEmail,
  registerViaUI,
  signInViaApi,
  submitForField,
  uniqueEmail
} from "./helpers";
import {
  closeDb,
  deleteUserByEmail,
  getUserByEmail,
  latestEmailVerificationToken,
  latestPasswordResetToken,
  markUserOnboarded
} from "./db";

// Users created during the run, cleaned up afterwards.
const createdEmails: string[] = [];

test.afterAll(async () => {
  for (const email of createdEmails) {
    await deleteUserByEmail(email);
  }
  await closeDb();
});

// A1 — Registration: new runner ----------------------------------------------
test("A1 registers a new runner and lands on the login page", async ({ page }) => {
  const email = uniqueEmail();
  createdEmails.push(email);

  await page.goto("/register");
  await page.fill('input[name="firstName"]', "E2E");
  await page.fill('input[name="lastName"]', "Runner");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Sup3rSecret!");
  await page.fill('input[name="confirmPassword"]', "Sup3rSecret!");
  await submitForField(page, "firstName").click();

  await expect(page).toHaveURL(/\/login\?.*registered=1/);

  const user = await getUserByEmail(email);
  expect(user, "user should exist in the DB").not.toBeNull();
  expect(user?.role).toBe("RUNNER");
  // Unverified on creation → a verification token was issued.
  expect(await latestEmailVerificationToken(user!.id)).toBeTruthy();
});

test("A1b rejects a duplicate email with an inline error", async ({ page }) => {
  await page.goto("/register");
  await page.fill('input[name="firstName"]', "Dupe");
  await page.fill('input[name="lastName"]', "Runner");
  await page.fill('input[name="email"]', DEMO.runner); // already seeded
  await page.fill('input[name="password"]', "Sup3rSecret!");
  await page.fill('input[name="confirmPassword"]', "Sup3rSecret!");
  await submitForField(page, "firstName").click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});

// A2 — Email verification ------------------------------------------------------
test("A2 verifies a new account via its emailed token", async ({ page }) => {
  const email = uniqueEmail();
  createdEmails.push(email);
  await registerViaUI(page, email);

  const user = await getUserByEmail(email);
  const token = await latestEmailVerificationToken(user!.id);
  expect(token, "verification token should be issued").toBeTruthy();

  await page.goto(`/verify-email/${token}`);
  // Consuming the token marks it used → no unused token remains.
  await expect.poll(() => latestEmailVerificationToken(user!.id)).toBeNull();
});

test("A2b an invalid verification token does not crash or verify", async ({ page }) => {
  const response = await page.goto("/verify-email/not-a-real-token-00000000");
  expect(response?.status()).toBeLessThan(500);
});

// A3 — Login -------------------------------------------------------------------
test("A3 logs in the demo runner and leaves the login page", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="email"]', DEMO.runner);
  await page.fill('input[name="password"]', DEMO_PASSWORD);
  await submitForField(page, "email").click();

  await expect(page).not.toHaveURL(/\/login/);
  expect(await getSessionEmail(page)).toBe(DEMO.runner);
});

test("A3b shows an error for a wrong password and stays on /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('input[name="email"]', DEMO.runner);
  await page.fill('input[name="password"]', "definitely-wrong");
  await submitForField(page, "email").click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  expect(await getSessionEmail(page)).toBeNull();
});

// A4 — Logout (also guards the "stale header after logout" regression) ---------
test("A4 signs out from the account menu and resets the header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInViaApi(page, DEMO.runner);
  await markUserOnboarded(DEMO.runner);
  await page.goto("/account");

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click(); // arms confirm
  await page.getByRole("menuitem", { name: "Confirm sign out?" }).click(); // confirms

  await expect(page).toHaveURL(/\/login/);
  expect(await getSessionEmail(page)).toBeNull();
  // Header reset: the logged-out CTAs are back (no stale account menu).
  await expect(page.getByRole("link", { name: DEMO.runner })).toHaveCount(0);
});

// A5 — Forgot password → reset -------------------------------------------------
test("A5 resets a password through the forgot → reset flow", async ({ page }) => {
  const email = uniqueEmail();
  createdEmails.push(email);
  await registerViaUI(page, email);

  // Request a reset.
  await page.goto("/forgot-password");
  await page.fill('input[name="email"]', email);
  await submitForField(page, "email").click();
  // The form is replaced by a success panel (no enumeration), so the input goes away.
  await expect(page.locator('input[name="email"]')).toHaveCount(0);

  // Read the emailed token and complete the reset.
  const user = await getUserByEmail(email);
  const token = await latestPasswordResetToken(user!.id);
  expect(token, "reset token should be issued").toBeTruthy();

  await page.goto(`/reset-password/${token}`);
  await page.fill('input[name="password"]', "BrandNewPass1!");
  await page.fill('input[name="confirmPassword"]', "BrandNewPass1!");
  await submitForField(page, "password").click();

  await expect(page).toHaveURL(/\/login\?reset=1/);
  // Token consumed → no unused reset token remains.
  await expect.poll(() => latestPasswordResetToken(user!.id)).toBeNull();
});

test("A5b unknown email reports success without revealing the account", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.fill('input[name="email"]', "nobody-here+e2e@example.com");
  await submitForField(page, "email").click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0); // same success UI
});

// A6 — Route guards ------------------------------------------------------------
test("A6 redirects protected routes to login when logged out", async ({ page }) => {
  await page.context().clearCookies();
  for (const path of ["/account/coach", "/organizer", "/admin"]) {
    await page.goto(path);
    await expect(page, `${path} should redirect to login`).toHaveURL(/\/login/);
  }
});

test("A6b a runner cannot reach the admin area", async ({ page }) => {
  await signInViaApi(page, DEMO.runner);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin(\/|$)/);
});
