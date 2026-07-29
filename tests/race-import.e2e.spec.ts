import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getPrisma } from "../src/lib/db";
import { DEMO, signInViaApi } from "./helpers";

const prisma = getPrisma();
let raceId: string | undefined;

test.afterAll(async () => {
  if (raceId) await prisma.raceEvent.delete({ where: { id: raceId } }).catch(() => undefined);
  await prisma.$disconnect();
});

test("AI-imported race requires human review before every publish path", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const race = await prisma.raceEvent.create({
    data: {
      source: "PLATFORM",
      status: "DRAFT",
      registrationStatus: "NOT_OPEN",
      title: `AI import review ${suffix}`,
      slug: `ai-import-review-${suffix}`,
      description: "Draft extracted from a test post.",
      raceType: "TEN_K",
      startDate: new Date("2026-10-10T08:00:00+01:00"),
      wilaya: "Alger",
      city: "Alger",
      importSource: "INSTAGRAM",
      importSourceUrl: `https://www.instagram.com/p/${suffix}/`,
      importExtractionJson: {
        race: { confidence: "low", notes: "Date was difficult to read." },
        reviewWarnings: ["Race date was missing or invalid; verify the provisional date."],
        imageUrls: []
      },
      categories: { create: { name: "10 km", raceType: "TEN_K", distanceKm: 10, priceDzd: 1500 } }
    }
  });
  raceId = race.id;

  await signInViaApi(page, DEMO.admin, undefined, "/admin/races");

  const blocked = await page.request.patch(`/api/admin/races/${race.id}/approve`);
  expect(blocked.status()).toBe(409);

  await page.goto(`/admin/races/${race.id}/edit`);
  await expect(page.getByText("Verification required", { exact: true })).toBeVisible();
  await expect(page.getByText("AI confidence: low", { exact: true })).toBeVisible();
  await expect(page.getByText("Race date was missing or invalid; verify the provisional date.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Distances and prices" })).toBeVisible();
  await expect(page.locator('input[name="distanceKm"]').first()).toHaveValue("10");

  await page.getByLabel("I verified this import against the original post").check();
  await page.getByRole("button", { name: "Save admin edits" }).click();
  await expect(page.getByText("Human verified", { exact: true })).toBeVisible();

  const approved = await page.request.patch(`/api/admin/races/${race.id}/approve`);
  expect(approved.ok()).toBeTruthy();
  const saved = await prisma.raceEvent.findUnique({ where: { id: race.id }, select: { status: true, importReviewedAt: true } });
  expect(saved?.status).toBe("PUBLISHED");
  expect(saved?.importReviewedAt).not.toBeNull();
});
