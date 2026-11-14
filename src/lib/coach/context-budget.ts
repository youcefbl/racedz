// A conservative, tokenizer-independent upper bound: a byte-level BPE token cannot consume less
// than one UTF-8 byte. This intentionally overcounts; do not use it for billing estimates. It avoids
// English character/token heuristics undercounting Arabic and avoids loading a tokenizer per request.
export const CONTEXT_TOKEN_UPPER_BOUND = 20_000;
export const REQUEST_TOKEN_UPPER_BOUND = 40_000; // includes instructions and output schema
export const jsonTokenUpperBound = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

export class CoachContextBudgetError extends Error {
  constructor() { super("Coach context exceeds its safe budget."); }
}

type CompactableContext = {
  recentRuns: unknown[];
  recentConversation: unknown[];
  coachMemory: unknown[] | null;
  analysedRun: { perKmSplits: unknown[] | null } | null;
  selection: { trimmedSections: string[] };
};

/** Preserve live request, deterministic safety/plan and the latest question/options verbatim. */
export function compactCoachContext<T extends CompactableContext>(context: T): T {
  const oversized = () => jsonTokenUpperBound(context) > CONTEXT_TOKEN_UPPER_BOUND;
  const mark = (name: string) => {
    if (!context.selection.trimmedSections.includes(name)) context.selection.trimmedSections.push(name);
  };
  while (oversized() && context.recentRuns.length > 0) {
    context.recentRuns = context.recentRuns.slice(0, -1); mark("recentRuns");
  }
  while (oversized() && context.recentConversation.length > 1) {
    context.recentConversation = context.recentConversation.slice(1); mark("recentConversation");
  }
  if (oversized() && context.analysedRun?.perKmSplits) {
    context.analysedRun = { ...context.analysedRun, perKmSplits: null }; mark("analysedRun.perKmSplits");
  }
  // Memory selection already ranks constraints first; drop lower-priority whole facts, not fragments.
  while (oversized() && (context.coachMemory?.length ?? 0) > 1) {
    context.coachMemory = context.coachMemory!.slice(0, -1); mark("coachMemory");
  }
  for (const key of ["records", "intensityDistribution", "nutrition", "targetRace"]) {
    if (oversized()) { Object.assign(context, { [key]: null }); mark(key); }
  }
  if (oversized()) throw new CoachContextBudgetError(); // never silently truncate safety or a question
  return context;
}
