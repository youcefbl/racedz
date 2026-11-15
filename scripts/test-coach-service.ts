/** Real PostgreSQL + real service + local fake provider. Refuses anything but the dedicated local CI DB. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const source = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(source.hostname), "Only a local test database is allowed");
  const testName = "racedz_coach_quality_ci";
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    const exists = await admin.$queryRaw<Array<{ datname: string }>>`SELECT datname FROM pg_database WHERE datname = ${testName}`;
    if (!exists.length) await admin.$executeRawUnsafe('CREATE DATABASE "racedz_coach_quality_ci"');
  } finally { await admin.$disconnect(); }
  source.pathname = `/${testName}`;
  process.env.DATABASE_URL = source.toString();
  process.env.COACH_WEATHER_ENABLED = "false";
  process.env.COACH_TRIAL_DAILY_LIMIT = "100";
  process.env.COACH_TRIAL_MONTHLY_LIMIT = "100";
  process.env.OPENAI_COACH_MODEL = "gpt-6-luna";
  process.env.OPENAI_API_KEY = "synthetic-local-provider";
  const migration = spawnSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, encoding: "utf8" });
  // Do not echo connection diagnostics containing credentials.
  assert.equal(migration.status, 0, "Dedicated CI database migrations failed; inspect Prisma locally");
  const { getPrisma } = await import("../src/lib/db");
  const { createCoachGoal, createCoachInteraction, createRunnerRun, CoachError } = await import("../src/lib/coach/service");
  const { withdrawCoachHealthConsent } = await import("../src/lib/coach/consent");
  const prisma = getPrisma();
  const contexts: Array<{ recentConversation: Array<{ followUpQuestion: string | null }>; request: { runnerQuestion: string } }> = [];
  let mode: "clarify" | "answer" | "invalid" = "clarify";
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    contexts.push(JSON.parse(body.input));
    const reply = { responseMode: mode === "clarify" ? "CLARIFY" : "ANSWER", summary: "Synthetic coach reply.",
      nextAction: null, quickReplies: mode === "clarify" ? ["All day", "After poor sleep"] : [], warningSignals: [],
      requiresProfessionalAdvice: false, usedSignalKeys: ["RUNNER_QUESTION"], missingSignalKeys: [],
      followUpQuestion: mode === "clarify" ? "When do you feel tired?" : null, memoryCandidates: [],
      // Required by non-CHAT provider schemas; harmlessly stripped by the compact CHAT schema.
      progressAssessment: "Synthetic assessment.", positiveSignals: [], recoveryAdvice: [] };
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ id: `mock-${contexts.length}`, model: "gpt-6-luna", object: "response", status: "completed",
      output: [{ id: "m", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text",
        text: mode === "invalid" ? "{" : JSON.stringify(reply), annotations: [] }] }],
      usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 1000 },
        output_tokens_details: { reasoning_tokens: 20 } } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  const ownedUsers: string[] = [];
  try {
    const goalInput = { goalType: "TEN_K", targetDate: new Date(Date.now() + 90 * 86_400_000), targetDistanceKm: 10,
      experienceLevel: "BEGINNER", currentWeeklyDistanceKm: 10, availableTrainingDays: [1, 3, 5], preferredLocale: "en", consent: true };
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({ data: { email: `coach-ci-${randomUUID()}@example.test`, passwordHash: "not-a-login-hash", role: "RUNNER", firstName: "Synthetic", lastName: "Runner" } });
      ownedUsers.push(user.id);
      await createCoachGoal(user.id, goalInput);
    }
    const [a, b] = ownedUsers;
    const ask = (message: string, extra = {}) => createCoachInteraction(a, { type: "CHAT", message, requestId: randomUUID(), ...extra });
    const first = await ask("I feel tired after running");
    assert.equal(first.status, "COMPLETED");
    mode = "answer";
    const requestId = randomUUID();
    const second = await ask("All day", { replyToInteractionId: first.id, requestId });
    assert.equal(second.status, "COMPLETED");
    assert.equal(contexts.at(-1)?.recentConversation.at(-1)?.followUpQuestion, "When do you feel tired?");
    const calls = contexts.length;
    assert.equal((await ask("All day", { replyToInteractionId: first.id, requestId })).id, second.id);
    assert.equal(contexts.length, calls, "replay is provider-free");
    const rejects = (code: string) => (error: unknown) => error instanceof CoachError && error.code === code;
    await assert.rejects(ask("All day", { replyToInteractionId: second.id, requestId }), rejects("REQUEST_ID_MISMATCH"), "changed anchor must conflict");
    await assert.rejects(createCoachInteraction(b, { type: "CHAT", message: "All day", replyToInteractionId: first.id }), rejects("CONVERSATION_NOT_FOUND"), "cross-account anchor");
    const run = await createRunnerRun(a, { startedAt: new Date(), distanceKm: 3, durationSeconds: 1200, perceivedEffort: 3 });
    await assert.rejects(ask("All day", { runId: run.run.id, replyToInteractionId: first.id }), rejects("CONVERSATION_NOT_FOUND"), "cross-run anchor");
    assert.equal(contexts.length, calls, "scope denials are provider-free");
    // Native renders POST_RUN and CHAT in one thread. A legacy runless CHAT reply must therefore
    // retain the preceding same-goal post-run clarification even without an explicit anchor.
    mode = "clarify";
    const postRun = await createCoachInteraction(a, { type: "POST_RUN", runId: run.run.id, requestId: randomUUID() });
    assert.equal(postRun.status, "COMPLETED");
    mode = "answer";
    assert.equal((await ask("All day")).status, "COMPLETED");
    assert.equal(contexts.at(-1)?.recentConversation.at(-1)?.followUpQuestion, "When do you feel tired?",
      "runless chat must see the post-run follow-up shown in its thread");
    // Backwards-compatible client: no explicit anchor, same goal/run.
    mode = "clarify";
    await ask("I feel tired after running");
    mode = "answer";
    assert.equal((await ask("After poor sleep")).status, "COMPLETED");
    const [meter] = await prisma.$queryRaw<Array<{ cacheWrite30mTokens: number; estimatedCostMicroUsd: number }>>`
      SELECT "cacheWrite30mTokens", "estimatedCostMicroUsd" FROM "AiUsageLog" WHERE "interactionId" = ${second.id}`;
    assert.equal(meter.cacheWrite30mTokens, 1000);
    assert.equal(meter.estimatedCostMicroUsd, 175);
    mode = "invalid";
    await assert.rejects(ask("How should I run today?"), rejects("OPENAI_INVALID_OUTPUT"), "invalid provider output");
    const [failed] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "AiUsageLog" WHERE "userId" = ${a} AND "status" = 'FAILED' AND "estimatedCostMicroUsd" = 175`;
    assert.equal(Number(failed.count), 1, "billable invalid output is counted");
    await createCoachGoal(a, goalInput);
    await assert.rejects(ask("All day", { replyToInteractionId: first.id }), rejects("CONVERSATION_NOT_FOUND"), "old-goal anchor");
    const beforeSafety = contexts.length;
    await withdrawCoachHealthConsent(b);
    await assert.rejects(createCoachInteraction(b, { type: "CHAT", message: "How should I run?" }), rejects("CONSENT_REQUIRED"), "consent before provider");
    const urgent = await createCoachInteraction(b, { type: "CHAT", message: "J'ai une douleur thoracique", replyToInteractionId: "not-owned" });
    assert.equal(urgent.status, "BLOCKED");
    const [urgentRow] = await prisma.$queryRaw<Array<{ replyToInteractionId: string | null }>>`
      SELECT "replyToInteractionId" FROM "CoachInteraction" WHERE "id" = ${urgent.id}`;
    assert.equal(urgentRow.replyToInteractionId, null, "provider-free safety paths must not persist an unvalidated anchor");
    assert.equal(contexts.length, beforeSafety, "safety and consent never reach the provider");
    console.log("PASS — isolated PostgreSQL: migrations, reply anchors, legacy follow-up, owner/goal/run isolation, idempotency, metering and safety/consent");
  } finally {
    // Exact IDs created by this invocation only; dedicated CI database, cascade cleanup.
    await prisma.user.deleteMany({ where: { id: { in: ownedUsers } } });
    await prisma.$disconnect();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Service test failed"); process.exitCode = 1; });
