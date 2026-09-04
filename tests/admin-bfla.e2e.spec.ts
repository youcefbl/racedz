import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getPrisma } from "../src/lib/db";
import { DEMO, signInViaApi } from "./helpers";

const prisma = getPrisma();

/**
 * SEC-004's own "honest remaining gap": `requireAdmin()` resolves a session and redirects, and the
 * admin functions underneath take an `actorId` without re-checking the role, so the boundary lives
 * at the route/page layer rather than in a callable function. `test:route-authz` already proves
 * every admin route carries the role check statically (the source has the guard); it cannot prove
 * the guard actually *works* against a real, signed-in, wrong-role session — that needs a session
 * cookie, which makes it this e2e case rather than another script.
 *
 * Four identities against the same targets: unauthenticated, a runner, an organizer, and the seeded
 * SUPERADMIN — three refused, one allowed. A boundary that quietly denies everyone (including the
 * real admin) would pass a "deny the wrong ones" check just as easily as a correct one; only
 * checking that the right identity succeeds catches that.
 */

const DENIED = [
  { name: "unauthenticated", email: null },
  { name: "a runner", email: DEMO.runner },
  { name: "an organizer", email: DEMO.organizer }
] as const;

for (const identity of DENIED) {
  test(`admin dashboard redirects ${identity.name} away, not into it`, async ({ page }) => {
    if (identity.email) await signInViaApi(page, identity.email);
    await page.goto("/admin");
    // requireAdmin() redirects — signed-out goes to /login, signed-in-wrong-role goes to /account.
    // Either way, the admin shell must never render for this identity.
    await expect(page).not.toHaveURL(/\/admin(\/|$)/);
    await expect(page.getByRole("heading", { name: /admin/i })).toHaveCount(0);
  });

  test(`GET /api/admin/organizations refuses ${identity.name}`, async ({ page }) => {
    if (identity.email) await signInViaApi(page, identity.email);
    const res = await page.request.get("/api/admin/organizations");
    // Signed-out hits requireMobileUser-style session absence before the role check on some
    // routes; this route checks role directly and returns 403 for any non-admin session,
    // including no session at all (session?.user?.role is undefined either way).
    expect(res.status(), `${identity.name} should not read the organizations list`).toBe(403);
  });
}

test("admin dashboard renders for the real SUPERADMIN, and the API returns real data", async ({ page }) => {
  await signInViaApi(page, DEMO.admin);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin(\/|$)/);

  const res = await page.request.get("/api/admin/organizations");
  expect(res.ok(), "the seeded SUPERADMIN should read the organizations list").toBeTruthy();
  const body = (await res.json()) as { data: unknown[]; meta: { count: number } };
  expect(Array.isArray(body.data)).toBe(true);
});

test("a runner cannot approve an organization even by calling the route directly", async ({ page }) => {
  // A fixture created directly, not "whatever the random seed happened to include" — the previous
  // version of this test relied on a PENDING organization existing by chance and skipped its own
  // assertion when the seed didn't have one, which is a test that usually proves nothing.
  const org = await prisma.organization.create({
    data: { name: "BFLA Test Org", slug: `bfla-test-org-${randomUUID()}` },
    select: { id: true, status: true }
  });
  expect(org.status).toBe("PENDING");

  try {
    await signInViaApi(page, DEMO.runner);
    const forged = await page.request.patch(`/api/admin/organizations/${org.id}/approve`);
    expect(forged.status(), "a runner must not be able to approve an organization by calling the route directly").toBe(403);

    // The organization must be provably untouched by the refused attempt, not just refused in
    // isolation — a route that denies the response but mutates anyway is worse than one that
    // errors honestly.
    const after = await prisma.organization.findUniqueOrThrow({ where: { id: org.id }, select: { status: true } });
    expect(after.status, "the organization's status must not have changed").toBe("PENDING");
  } finally {
    await prisma.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  }
});
