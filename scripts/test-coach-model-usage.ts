import assert from "node:assert/strict";
import { DEFAULT_COACH_MODEL, readCoachUsage } from "../src/lib/coach/model-usage";
assert.equal(DEFAULT_COACH_MODEL, "gpt-6-luna");
const usage = {
  input_tokens: 12000, output_tokens: 600,
  input_tokens_details: { cached_tokens: 4000, cache_write_tokens: 7000,
    cache_write_tokens_details: { ttl_30m_tokens: 3000, ttl_12h_tokens: 4000 } },
  output_tokens_details: { reasoning_tokens: 200 }
};
// 1000 ordinary*0.1 + 4000 read*0.01 + 3000 write*0.125 + 4000 write*0.25 + 600 output*0.5.
assert.equal(readCoachUsage(DEFAULT_COACH_MODEL, usage).estimatedCostMicroUsd, 1815);
assert.equal(readCoachUsage("gpt-6-luna-2026-11-14", usage).estimatedCostMicroUsd, 1815);
assert.equal(readCoachUsage("gpt-6-luna-unpriced-variant", usage).estimatedCostMicroUsd, null);
assert.equal(readCoachUsage("unknown", usage).estimatedCostMicroUsd, null);
assert.equal(readCoachUsage(DEFAULT_COACH_MODEL, null).estimatedCostMicroUsd, null);
assert.equal(readCoachUsage(DEFAULT_COACH_MODEL, { ...usage, input_tokens: 10 }).estimatedCostMicroUsd, null);
assert.equal(readCoachUsage(DEFAULT_COACH_MODEL, { ...usage, input_tokens_details: { cached_tokens: 4000 } }).estimatedCostMicroUsd, null);
assert.equal(readCoachUsage(DEFAULT_COACH_MODEL, { ...usage, input_tokens_details: { ...usage.input_tokens_details, cache_write_tokens: 8000 } }).estimatedCostMicroUsd, null);
assert.equal(readCoachUsage(DEFAULT_COACH_MODEL, { ...usage, output_tokens_details: { reasoning_tokens: 0 } }).estimatedCostMicroUsd, 1815,
  "reasoning tokens are included in output, never charged twice");
assert.equal(readCoachUsage(DEFAULT_COACH_MODEL, { input_tokens: 4000, output_tokens: 600,
  input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } }).estimatedCostMicroUsd, 700);
assert.equal(readCoachUsage("gpt-5.4-mini", { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 0 } }).estimatedCostMicroUsd, 1200);
console.log("PASS — Luna default, standard/cache-write pricing, snapshots, incomplete metering and reasoning accounting");
