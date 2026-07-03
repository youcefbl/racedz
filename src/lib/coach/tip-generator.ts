import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { TipCategory } from "@/lib/coach/tips";

// Generates candidate coach tips with OpenAI. Output lands as PROPOSED tips for an admin
// to review, edit, and publish — it is never shown to runners directly. Mirrors the
// structured-output approach in openai.ts (responses.parse + zodTextFormat).

const DEFAULT_MODEL = "gpt-5.4-mini";

const tipSchema = z.object({
  textEn: z.string().describe("The tip in English."),
  textFr: z.string().describe("The same tip in French."),
  textAr: z.string().describe("The same tip in Arabic.")
});

const tipsResponseSchema = z.object({
  tips: z.array(tipSchema)
});

export type GeneratedTip = z.infer<typeof tipSchema>;

export class TipGeneratorError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "TipGeneratorError";
  }
}

const CATEGORY_GUIDANCE: Record<TipCategory, string> = {
  GENERAL: "any runner, regardless of level or goal",
  BEGINNER: "brand-new runners building their first habit and base fitness",
  HEAVY_WEIGHT: "heavier runners who need joint-friendly, low-impact, progressive advice",
  EXPERIENCED: "advanced runners refining performance, pacing, and periodization",
  MARATHON: "runners training for a marathon or half-marathon: long runs, fueling, tapering"
};

export async function generateTipProposals(category: TipCategory, count: number): Promise<GeneratedTip[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_COACH_MODEL?.trim() || DEFAULT_MODEL;
  const safeCount = Math.min(10, Math.max(1, Math.round(count)));

  if (!apiKey) {
    throw new TipGeneratorError("AI generation is not configured.", "OPENAI_NOT_CONFIGURED");
  }

  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });

  const instructions = [
    "You write short, practical running-training tips for the ZidRun app.",
    `Produce exactly ${safeCount} distinct tips for: ${CATEGORY_GUIDANCE[category]}.`,
    "Each tip: one or two sentences, actionable, safe, and encouraging.",
    "Do not diagnose conditions or prescribe medication; be conservative on safety.",
    "Provide each tip in English, French, and Arabic with the same meaning.",
    "Return only the structured response."
  ].join("\n");

  try {
    const result = await client.responses.parse({
      model,
      instructions,
      input: `Category: ${category}. Count: ${safeCount}.`,
      max_output_tokens: 3000,
      reasoning: { effort: "low" },
      store: false,
      text: { format: zodTextFormat(tipsResponseSchema, "coach_tip_proposals") }
    });

    const parsed = result.output_parsed;
    if (!parsed || parsed.tips.length === 0) {
      throw new TipGeneratorError("The generator returned no usable tips.", "OPENAI_INVALID_OUTPUT");
    }

    return parsed.tips
      .map((tip) => ({ textEn: tip.textEn.trim(), textFr: tip.textFr.trim(), textAr: tip.textAr.trim() }))
      .filter((tip) => tip.textEn && tip.textFr && tip.textAr)
      .slice(0, safeCount);
  } catch (error) {
    if (error instanceof TipGeneratorError) throw error;
    const code = error instanceof OpenAI.APIError ? `OPENAI_${error.status ?? "ERROR"}` : "OPENAI_REQUEST_FAILED";
    throw new TipGeneratorError("AI tip generation is temporarily unavailable.", code);
  }
}
