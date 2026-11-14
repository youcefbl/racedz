/** Product calendar, independent of the host timezone. Date-only sleep labels are not instants. */
export const COACH_TIME_ZONE = "Africa/Algiers";
export function coachLocalDate(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: COACH_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
export function shiftDateLabel(label: string, days: number): string {
  return new Date(Date.parse(`${label}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
export function describeSleep(entries: Array<{ night: Date | string; durationMinutes: number }>, now: Date) {
  const today = coachLocalDate(now);
  const yesterday = shiftDateLabel(today, -1);
  const windowStart = shiftDateLabel(today, -7);
  const byNight = new Map<string, number>();
  for (const entry of entries) {
    // SleepLog.night is a @db.Date label, including when Prisma returns a UTC-midnight Date.
    const night = typeof entry.night === "string" ? entry.night.slice(0, 10) : entry.night.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night) || night < windowStart || night > yesterday ||
      !Number.isFinite(entry.durationMinutes) || entry.durationMinutes < 0 || entry.durationMinutes > 1440) continue;
    byNight.set(night, entry.durationMinutes);
  }
  if (byNight.size === 0) return null;
  const toHours = (minutes: number) => Math.round(minutes / 6) / 10;
  const nights = [...byNight.entries()].sort(([a], [b]) => b.localeCompare(a));
  return {
    windowStart, windowEnd: yesterday, nightsLoggedLast7: nights.length,
    averageHoursLast7: toHours(nights.reduce((total, [, minutes]) => total + minutes, 0) / nights.length),
    lastNightDate: yesterday,
    lastNightHours: byNight.has(yesterday) ? toHours(byNight.get(yesterday)!) : null,
    recentNights: nights.map(([night, minutes]) => ({ night, hours: toHours(minutes) }))
  };
}
