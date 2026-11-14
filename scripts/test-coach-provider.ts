import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { assembleCoachContext } from "../src/lib/coach/context";
import { generateCoachResponse, CoachProviderError } from "../src/lib/coach/openai";
import { coachContextFixture, COACH_EVAL_NOW } from "./fixtures/coach-context";

async function main() {
  const previous = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_COACH_MODEL: process.env.OPENAI_COACH_MODEL };
  let mode: "ok" | "invalid" | "incomplete" = "ok";
  const requests: Array<Record<string, unknown>> = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    const reply = { responseMode: "ANSWER", summary: "Keep this run comfortable.", nextAction: null,
      quickReplies: [], warningSignals: [], requiresProfessionalAdvice: false,
      usedSignalKeys: ["GOAL", "WEATHER"], missingSignalKeys: [], followUpQuestion: null, memoryCandidates: [] };
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ id: "synthetic-response", object: "response", model: "gpt-6-luna", created_at: 0,
      status: mode === "incomplete" ? "incomplete" : "completed",
      output: [{ id: "message-1", type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", annotations: [], text: mode === "invalid" ? "{" : JSON.stringify(reply) }] }],
      usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 1000 },
        output_tokens_details: { reasoning_tokens: 20 } } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.env.OPENAI_API_KEY = "synthetic-not-a-real-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  delete process.env.OPENAI_COACH_MODEL;
  try {
    const context = assembleCoachContext(coachContextFixture(), COACH_EVAL_NOW).context;
    const result = await generateCoachResponse(context, "synthetic", "CHAT", { maxRetries: 0 });
    assert.equal(result.model, "gpt-6-luna");
    assert.equal(result.usage.estimatedCostMicroUsd, 175);
    assert.deepEqual(result.response.usedSignalKeys, ["GOAL"]);
    assert.equal(requests[0].store, false);
    assert.equal(requests[0].service_tier, "default");
    assert.deepEqual(requests[0].reasoning, { effort: "low" });
    assert.equal(requests[0].max_output_tokens, 2048);
    for (const next of ["invalid", "incomplete"] as const) {
      mode = next;
      await assert.rejects(generateCoachResponse(context, "synthetic", "CHAT", { maxRetries: 0 }),
        (error: unknown) => error instanceof CoachProviderError && error.code === "OPENAI_INVALID_OUTPUT" &&
          error.usage?.estimatedCostMicroUsd === 175 && error.providerResponseId === "synthetic-response");
    }
    const before = requests.length;
    await assert.rejects(generateCoachResponse({ ...context, request: { ...context.request, runnerQuestion: "ع".repeat(50_000) } }, "large"),
      (error: unknown) => error instanceof CoachProviderError && error.code === "COACH_CONTEXT_TOO_LARGE");
    assert.equal(requests.length, before, "budget rejection must happen before network contact");
    console.log("PASS — mock HTTP provider, Luna request, public contract, paid-invalid usage and preflight budget");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
