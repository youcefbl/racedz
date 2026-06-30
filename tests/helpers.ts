import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "racedz-demo-password";

export const DEMO = {
  runner: "runner@example.com",
  organizer: "organizer@zidrun.com",
  admin: "admin@zidrun.com"
} as const;

/**
 * Fast, UI-free sign-in via the next-auth credentials callback (CSRF + POST).
 * Use for any test whose subject is NOT the login UI itself.
 */
export async function signInViaApi(
  page: Page,
  email: string,
  password: string = DEMO_PASSWORD,
  callbackUrl = "/account"
) {
  await page.context().clearCookies();

  const csrf = await page.request.get("/api/auth/csrf");
  expect(csrf.ok(), "GET /api/auth/csrf should succeed").toBeTruthy();
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };

  const res = await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password, callbackUrl }
  });
  expect(res.ok(), `credentials sign-in for ${email} should succeed`).toBeTruthy();

  await expect.poll(() => getSessionEmail(page), { timeout: 10_000 }).toBe(email);
}

export async function getSessionEmail(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/auth/session");
  const session = (await res.json()) as { user?: { email?: string } };
  return session.user?.email ?? null;
}

export async function signOutViaApi(page: Page) {
  const csrf = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  await page.request.post("/api/auth/signout", { form: { csrfToken, callbackUrl: "/" } });
  await page.context().clearCookies();
}

/** Asserts the page does not scroll horizontally (run at mobile widths especially). */
export async function assertNoHorizontalOverflow(page: Page) {
  const d = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(d.content, "no horizontal overflow").toBeLessThanOrEqual(d.viewport + 1);
}

/** Unique email per run so registration tests never collide. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Submit button scoped to the form that contains the given field (i18n-proof). */
export function submitForField(page: Page, fieldName: string) {
  return page.locator(`form:has(input[name="${fieldName}"]) button[type="submit"]`);
}

/** Full registration journey through the UI. Password meets the 8+ char policy. */
export async function registerViaUI(page: Page, email: string, password = "Sup3rSecret!") {
  await page.goto("/register");
  await page.fill('input[name="firstName"]', "E2E");
  await page.fill('input[name="lastName"]', "Tester");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await submitForField(page, "firstName").click();
  await expect(page).toHaveURL(/registered=1/);
}
