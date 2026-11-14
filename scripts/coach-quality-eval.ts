/** Synthetic offline/provider evaluation. Never reads/writes the application DB or calls its API. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { loadEnvConfig } from "@next/env";
import { assembleCoachContext, type ConversationTurn } from "../src/lib/coach/context";
import { recentCoachReply, type ConversationRow } from "../src/lib/coach/conversation";
import { containsUrgentSymptomText, buildBlockedCoachResponse, urgentSymptomDecision, enforceCoachSafety } from "../src/lib/coach/safety";
import { evaluateTopicality, buildOffTopicCoachResponse } from "../src/lib/coach/topicality";
import { generateCoachResponse, CoachProviderError, COACH_PROMPT_VERSION } from "../src/lib/coach/openai";
import { readCoachUsage, DEFAULT_COACH_MODEL } from "../src/lib/coach/model-usage";
import { REQUEST_TOKEN_UPPER_BOUND } from "../src/lib/coach/context-budget";
import { COACH_QUALITY_FIXTURES } from "./fixtures/coach-quality";
import { COACH_EVAL_NOW } from "./fixtures/coach-context";

async function main() {
  const args = process.argv.slice(2);
  const option = (key: string) => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1]; };
  const live = args.includes("--live");
  const model = option("--model") ?? DEFAULT_COACH_MODEL;
  const samples = Number(option("--samples") ?? (live ? "2" : "1"));
  const maxCostUsd = Number(option("--max-cost-usd"));
  const output = option("--output");
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 5, "--samples must be 1..5");
  const fixtures = COACH_QUALITY_FIXTURES.filter((fixture) => !option("--case") || fixture.id.includes(option("--case")!));
  assert.ok(fixtures.length > 0, "No matching cases");
  assert.equal(COACH_QUALITY_FIXTURES.length, 60);
  if (live) {
    assert.ok(Number.isFinite(maxCostUsd) && maxCostUsd > 0 && maxCostUsd <= 10, "Paid mode requires --max-cost-usd (0 < cap <= 10)");
    assert.ok(output, "Paid mode requires --output for reproducible evidence");
    loadEnvConfig(process.cwd());
    assert.ok(process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required for paid mode");
    process.env.OPENAI_COACH_MODEL = model;
  }
  const perCallReserve = readCoachUsage(model, { input_tokens: REQUEST_TOKEN_UPPER_BOUND, output_tokens: 3072,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: REQUEST_TOKEN_UPPER_BOUND,
      cache_write_tokens_details: { ttl_30m_tokens: 0, ttl_12h_tokens: REQUEST_TOKEN_UPPER_BOUND } } }).estimatedCostMicroUsd;
  if (live) assert.notEqual(perCallReserve, null, "Model must have known pricing before paid evaluation");
  let budgetSpent = 0;
  let stopped: string | null = null;
  const results: Array<Record<string, unknown>> = [];
  const latencies: number[] = [];
  let paidCalls = 0;
  outer: for (const fixture of fixtures) for (let sample = 1; sample <= samples; sample += 1) {
    const history: ConversationTurn[] = [...(fixture.input.recentConversation ?? [])];
    let exerciseHold = false;
    for (const [index, question] of fixture.questions.entries()) {
      const now = new Date(COACH_EVAL_NOW.getTime() + index * 60_000);
      const interaction = { ...fixture.input.interaction, message: question };
      const input = { ...fixture.input, interaction, recentConversation: history.slice(-6) };
      const envelope = assembleCoachContext(input, now);
      const locale = envelope.context.request.responseLocale;
      const previous = history.at(-1);
      const rows: ConversationRow[] = previous ? [{ id: "synthetic-previous", goalId: input.goal.id, runId: null,
        type: previous.type, status: "COMPLETED", createdAt: new Date(previous.at), userMessage: previous.runnerQuestion,
        safety: { level: previous.safetyLevel ?? "CLEAR" }, response: {
          summary: previous.coachSummary ?? "", followUpQuestion: previous.followUpQuestion ?? null,
          quickReplies: previous.quickReplies ?? []
        } }] : [];
      exerciseHold ||= containsUrgentSymptomText(question);
      const topical = interaction.type !== "CHAT" || evaluateTopicality(question, recentCoachReply(rows, now)).onTopic;
      if (index === 0 && fixture.scenario === "urgent") assert.ok(exerciseHold, fixture.id);
      if (index === 0 && fixture.scenario === "off-topic") assert.equal(topical, false, fixture.id);
      if (index === 0 && !["urgent", "off-topic"].includes(fixture.scenario)) assert.ok(topical, `Valid first turn rejected: ${fixture.id}`);
      let reply = exerciseHold ? buildBlockedCoachResponse(urgentSymptomDecision(), locale) :
        !topical ? buildOffTopicCoachResponse(locale) : null;
      let usage = null;
      let error: string | null = null;
      if (!reply && live) {
        if (budgetSpent + perCallReserve! > maxCostUsd * 1_000_000) { stopped = "budget-reserve"; break outer; }
        paidCalls += 1;
        try {
          const generated = await generateCoachResponse(envelope.context, `quality-${fixture.id}-${sample}-${index}`, interaction.type, { maxRetries: 0 });
          usage = generated.usage;
          reply = enforceCoachSafety(generated.response, input.safety, input.skeleton, locale);
        } catch (failure) {
          usage = failure instanceof CoachProviderError ? failure.usage ?? null : null;
          error = failure instanceof CoachProviderError ? failure.code : "EVALUATION_ERROR";
        }
        budgetSpent += usage?.estimatedCostMicroUsd ?? perCallReserve!;
        if (usage?.providerLatencyMs != null) latencies.push(usage.providerLatencyMs);
        if (usage?.estimatedCostMicroUsd == null) stopped = "unknown-cost-or-provider-error";
      }
      results.push({ caseId: fixture.id, sample, turn: index + 1, question, rubric: fixture.rubric,
        contextHash: envelope.meta.hash, contextVersion: envelope.meta.contextVersion, tokenUpperBound: envelope.meta.tokenUpperBound,
        gate: exerciseHold ? "urgent" : !topical ? "off-topic" : "provider",
        mode: live ? "live" : "dry-run", reply, usage, error, humanReview: null });
      if (reply) history.push({ type: interaction.type, at: now, runnerQuestion: question, coachSummary: reply.summary,
        followUpQuestion: reply.followUpQuestion, quickReplies: reply.quickReplies, nextAction: reply.nextAction,
        safetyLevel: exerciseHold ? "BLOCKED" : input.safety.level });
      // Dry mode validates assembly/gates, not hypothetical model answers or subsequent dialogue.
      if (!live || stopped) { if (stopped) break outer; break; }
    }
  }
  latencies.sort((a, b) => a - b);
  const percentile = (p: number) => latencies.length ? latencies[Math.max(0, Math.ceil(latencies.length * p) - 1)] : null;
  const report = {
    fixtureVersion: "coach-quality-v1-2026-11-14", fixtureHash: createHash("sha256").update(JSON.stringify(COACH_QUALITY_FIXTURES)).digest("hex"),
    promptVersion: COACH_PROMPT_VERSION, model, live, samples, selectedCases: fixtures.length,
    paidCalls, budgetChargedMicroUsd: budgetSpent, stopped, p50ProviderMs: percentile(0.5), p95ProviderMs: percentile(0.95),
    qualityVerdict: "NOT_GRADED", costPerResolvedConversation: null, results
  };
  if (output) {
    const target = resolve(output);
    // Never overwrite an earlier run's evidence accidentally.
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  }
  console.log(JSON.stringify({ mode: live ? "live" : "dry-run", cases: fixtures.length, recordedTurns: results.length,
    paidCalls, budgetChargedMicroUsd: budgetSpent, stopped, qualityVerdict: report.qualityVerdict }));
  if (stopped || results.some((result) => result.error)) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Evaluation failed"); process.exitCode = 1; });
