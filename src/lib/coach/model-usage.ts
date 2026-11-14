// Standard processing, verified 2026-11-14 against the official model/pricing and prompt-caching
// docs. Cache writes REPLACE the uncached rate, they are not an additional input charge.
// https://developers.openai.com/api/docs/models/gpt-6-luna
// https://developers.openai.com/api/docs/guides/prompt-caching#monitor-cache-performance
export const DEFAULT_COACH_MODEL = "gpt-6-luna";
const PRICES = [
  { model: "gpt-6-luna", input: 0.1, cached: 0.01, output: 0.5, writes: true },
  { model: "gpt-6.1-terra", input: 1, cached: 0.05, output: 5, writes: true },
  { model: "gpt-5.6-luna", input: 0.2, cached: 0.02, output: 1.2, writes: true },
  { model: "gpt-5.4-mini", input: 0.75, cached: 0.075, output: 4.5, writes: false }
];

export type CoachUsage = {
  inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens: number;
  cacheWrite30mTokens: number; cacheWrite12hTokens: number;
  providerLatencyMs: number | null;
  estimatedCostMicroUsd: number | null;
};
type RawUsage = {
  input_tokens?: number; output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number;
    cache_write_tokens_details?: { ttl_30m_tokens?: number; ttl_12h_tokens?: number } };
  output_tokens_details?: { reasoning_tokens?: number };
};
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const count = (value: unknown) => isCount(value) ? value : 0;

export function readCoachUsage(model: string, raw: RawUsage | null | undefined, latencyMs: number | null = null): CoachUsage {
  const details = raw?.input_tokens_details;
  const inputTokens = count(raw?.input_tokens);
  const cachedInputTokens = count(details?.cached_tokens);
  const outputTokens = count(raw?.output_tokens);
  const writes = details?.cache_write_tokens;
  const lifetimes = details?.cache_write_tokens_details;
  // With no lifetime breakdown, our request uses the documented default 30-minute retention.
  const cacheWrite30mTokens = count(lifetimes ? lifetimes.ttl_30m_tokens : writes);
  const cacheWrite12hTokens = count(lifetimes?.ttl_12h_tokens);
  const rates = PRICES.find((rate) => model === rate.model ||
    new RegExp(`^${rate.model.replaceAll(".", "\\.")}-\\d{4}-\\d{2}-\\d{2}$`).test(model));
  const consistent = isCount(raw?.input_tokens) && isCount(raw?.output_tokens) && isCount(details?.cached_tokens) &&
    (!rates?.writes || isCount(writes)) &&
    (!lifetimes || (isCount(lifetimes.ttl_30m_tokens) && isCount(lifetimes.ttl_12h_tokens))) &&
    (writes === undefined || writes === cacheWrite30mTokens + cacheWrite12hTokens) &&
    inputTokens >= cachedInputTokens + cacheWrite30mTokens + cacheWrite12hTokens;
  const ordinary = inputTokens - cachedInputTokens - cacheWrite30mTokens - cacheWrite12hTokens;
  return {
    inputTokens, cachedInputTokens, outputTokens, reasoningTokens: count(raw?.output_tokens_details?.reasoning_tokens),
    cacheWrite30mTokens, cacheWrite12hTokens, providerLatencyMs: latencyMs,
    // At $/million-token rates, multiplication directly yields micro-USD. Output already includes
    // reasoning; charging it again would double count. Unknown/invalid metering is never free.
    estimatedCostMicroUsd: rates && consistent ? Math.round(
      ordinary * rates.input + cachedInputTokens * rates.cached + outputTokens * rates.output +
      cacheWrite30mTokens * rates.input * 1.25 + cacheWrite12hTokens * rates.input * 2.5
    ) : null
  };
}
