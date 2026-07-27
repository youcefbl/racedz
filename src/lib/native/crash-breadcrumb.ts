// Small mutable bag of safe, non-PII facts about the current guided-run session, kept up to
// date by the recorder as it renders. Read by the RunRecorder error boundary at crash time so a
// report has actionable context (run status, step index, point count) without ever including
// GPS coordinates, notes, or anything else that could identify where the runner was.
export type RunBreadcrumb = Record<string, string | number | boolean | null>;

let current: RunBreadcrumb = {};

export function setRunBreadcrumb(partial: RunBreadcrumb): void {
  current = { ...current, ...partial };
}

export function getRunBreadcrumb(): RunBreadcrumb {
  return current;
}
