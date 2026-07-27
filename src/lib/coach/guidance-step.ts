export function clampedStepAt<T>(steps: readonly T[], index: number): T | null {
  if (steps.length === 0) return null;
  const clamped = Math.min(Math.max(Math.trunc(index), 0), steps.length - 1);
  return steps[clamped] ?? null;
}

export function optionalStepAt<T>(steps: readonly T[], index: number): T | null {
  const exact = Math.trunc(index);
  if (exact < 0 || exact >= steps.length) return null;
  return steps[exact] ?? null;
}
