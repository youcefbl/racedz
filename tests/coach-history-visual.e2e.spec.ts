import { expect, test } from "@playwright/test";
import { getUserByEmail, markUserOnboarded, ensureCoachSubscription, ensureCoachGoal, closeDb } from "./db";
import { getPrisma } from "../src/lib/db";

// Visual check for paginated conversation history + the human-coach note badge (Phase 3). Seeds a
// dozen-plus interactions (so the "load older" control appears) plus one human note, then screenshots
// the coach conversation and the state after paging.

const prisma = getPrisma();

test.afterAll(async () => {
  const user = await getUserByEmail("runner@example.com");
  if (user) {
    await prisma.$executeRaw`DELETE FROM "CoachInteraction" WHERE "userId" = ${user.id} AND ("userMessage" LIKE 'hist-%' OR "type" = 'HUMAN_NOTE')`;
  }
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

test("conversation history pages older messages and badges human notes", async ({ page }, testInfo) => {
  await signIn(page);
  const user = await getUserByEmail("runner@example.com");
  expect(user).toBeTruthy();
  const userId = user!.id;
  await markUserOnboarded("runner@example.com");
  await ensureCoachSubscription(userId);
  await ensureCoachGoal(userId);

  await prisma.$executeRaw`DELETE FROM "CoachInteraction" WHERE "userId" = ${userId} AND ("userMessage" LIKE 'hist-%' OR "type" = 'HUMAN_NOTE')`;
  for (let i = 0; i < 16; i += 1) {
    const at = new Date(Date.now() - (i + 1) * 3_600_000);
    await prisma.$executeRaw`
      INSERT INTO "CoachInteraction" ("id","userId","type","status","userMessage","response","safety","promptVersion","createdAt","completedAt")
      VALUES (gen_random_uuid(), ${userId}, 'CHAT'::"CoachInteractionType", 'COMPLETED'::"CoachInteractionStatus",
              ${`hist-${i}: what should I do this week?`}, ${JSON.stringify({ summary: `This is archived coaching answer number ${i}. Keep the easy days easy and build gradually.` })}::jsonb, '{}'::jsonb, 'test', ${at}, ${at})
    `;
  }
  // One human-coach note, most recent, so it sits at the bottom of the log.
  await prisma.$executeRaw`
    INSERT INTO "CoachInteraction" ("id","userId","type","status","response","safety","promptVersion","authorId","createdAt","completedAt")
    VALUES (gen_random_uuid(), ${userId}, 'HUMAN_NOTE'::"CoachInteractionType", 'COMPLETED'::"CoachInteractionStatus",
            ${JSON.stringify({ summary: "Great work this block. Keep every long run strictly aerobic for the next two weeks while the calf settles." })}::jsonb, '{}'::jsonb, 'human-note', ${userId}, NOW(), NOW())
  `;

  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/account/coach");
  const hasCoachTab = await page.getByRole("button", { name: "Coach", exact: true }).isVisible().catch(() => false);
  test.skip(!hasCoachTab, "coach dashboard not available for runner@example.com in this DB");

  await page.getByRole("button", { name: "Coach", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ask your coach" })).toBeVisible();
  await expect(page.getByText("From your coach").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Load older messages" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("history-initial.png"), fullPage: true });

  await page.getByRole("button", { name: "Load older messages" }).click();
  // After paging, either more remain or we hit the start marker.
  await expect(page.getByText(/You've reached the start of your history\.|Load older messages/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("history-after-load.png"), fullPage: true });
});
