// Shared helpers for race finish times. Times are stored as whole seconds; the UI works in
// "HH:MM:SS" (or "MM:SS") strings.

export const RACE_RESULT_STATUSES = ["FINISHED", "DNF", "DNS", "DSQ"] as const;
export type RaceResultStatusValue = (typeof RACE_RESULT_STATUSES)[number];

export function isRaceResultStatus(value: unknown): value is RaceResultStatusValue {
  return typeof value === "string" && (RACE_RESULT_STATUSES as readonly string[]).includes(value);
}

// Parse "H:MM:SS", "MM:SS", or "SS" into whole seconds. Returns null for blank/invalid input so
// the caller can treat "no time entered" distinctly from "zero".
export function parseFinishTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length > 3 || parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  let seconds = 0;
  for (const n of nums) seconds = seconds * 60 + n;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 3600) return null;
  return seconds;
}

// Format whole seconds as "H:MM:SS" (drops the hour when under an hour → "MM:SS").
export function formatFinishTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
