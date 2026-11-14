import { readFile } from "node:fs/promises";
import { z } from "zod";

const ratingSchema = z.array(z.object({ caseId: z.string(), sample: z.number().int().min(1),
  correctness: z.number().int().min(1).max(5), continuity: z.number().int().min(1).max(5),
  language: z.number().int().min(1).max(5), usefulness: z.number().int().min(1).max(5),
  safe: z.boolean(), resolved: z.boolean() }));
const reportSchema = z.object({ live: z.literal(true), selectedCases: z.number(), samples: z.number(), stopped: z.string().nullable(),
  model: z.string(), fixtureHash: z.string(), promptVersion: z.string(),
  p50ProviderMs: z.number().nullable(), p95ProviderMs: z.number().nullable(),
  results: z.array(z.object({ caseId: z.string(), sample: z.number(), gate: z.string(), error: z.string().nullable(),
    usage: z.object({ estimatedCostMicroUsd: z.number().nullable(), inputTokens: z.number(), cachedInputTokens: z.number(),
      outputTokens: z.number() }).passthrough().nullable() })) });

async function main() {
  const [reportPath, ratingsPath] = process.argv.slice(2);
  if (!reportPath || !ratingsPath) throw new Error("Usage: coach-quality-report.ts <live-report.json> <human-ratings.json>");
  const report = reportSchema.parse(JSON.parse(await readFile(reportPath, "utf8")));
  const ratings = ratingSchema.parse(JSON.parse(await readFile(ratingsPath, "utf8")));
  const key = (row: { caseId: string; sample: number }) => `${row.caseId}/${row.sample}`;
  const groups = new Set(report.results.map(key));
  if (new Set(ratings.map(key)).size !== ratings.length || ratings.some((row) => !groups.has(key(row)))) {
    throw new Error("Ratings contain duplicate or unknown conversation samples");
  }
  const complete = !report.stopped && groups.size === report.selectedCases * report.samples && ratings.length === groups.size;
  const knownCost = report.results.filter((row) => row.gate === "provider").every((row) => row.usage?.estimatedCostMicroUsd != null);
  const total = report.results.reduce((sum, row) => sum + (row.usage?.estimatedCostMicroUsd ?? 0), 0);
  const resolved = ratings.filter((row) => row.resolved && row.safe && Math.min(row.correctness, row.continuity, row.language, row.usefulness) >= 4).length;
  const qualityPass = complete && resolved === groups.size && report.results.every((row) => row.error === null);
  console.log(JSON.stringify({ model: report.model, fixtureHash: report.fixtureHash, promptVersion: report.promptVersion,
    qualityVerdict: qualityPass ? "PASS_HUMAN_REVIEW" : complete ? "FAIL_HUMAN_REVIEW" : "INCOMPLETE_REVIEW",
    reviewedConversations: ratings.length, resolvedConversations: resolved,
    estimatedCostMicroUsd: knownCost ? total : null,
    costPerResolvedConversationMicroUsd: complete && knownCost && resolved ? Math.round(total / resolved) : null,
    p50ProviderMs: report.p50ProviderMs, p95ProviderMs: report.p95ProviderMs }, null, 2));
  if (!qualityPass) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Report failed"); process.exitCode = 1; });
