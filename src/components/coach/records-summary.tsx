"use client";

import { Flame, Gauge, Route as RouteIcon, Timer, Trophy } from "lucide-react";
import type { CoachLocale } from "@/components/coach/types";

// Serialized shape of PersonalRecords crossing the server→client boundary (Dates become strings).
export type RecordsSummary = {
  totalRuns: number;
  totalDistanceKm: number;
  totalDurationSeconds: number;
  longestRunKm: number;
  longestRunAt: string | null;
  longestRunId: string | null;
  fastestPace: { seconds: number; atRunId: string; achievedAt: string } | null;
  best5k: { seconds: number; atRunId: string; achievedAt: string } | null;
  best10k: { seconds: number; atRunId: string; achievedAt: string } | null;
  currentStreakWeeks: number;
  longestStreakWeeks: number;
};

const copy = {
  en: {
    title: "Your records",
    personalBests: "Personal bests",
    longest: "Longest run",
    fastestPace: "Fastest pace",
    best5k: "Best 5K",
    best10k: "Best 10K",
    streak: "Week streak",
    weeks: (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`,
    bestStreak: (n: number) => `Best: ${n}`,
    totalDistance: "Total distance",
    totalRuns: (n: number) => `${n} ${n === 1 ? "run" : "runs"}`,
    none: "—"
  },
  fr: {
    title: "Vos records",
    personalBests: "Records personnels",
    longest: "Course la plus longue",
    fastestPace: "Allure la plus rapide",
    best5k: "Meilleur 5 km",
    best10k: "Meilleur 10 km",
    streak: "Série de semaines",
    weeks: (n: number) => `${n} ${n === 1 ? "semaine" : "semaines"}`,
    bestStreak: (n: number) => `Record : ${n}`,
    totalDistance: "Distance totale",
    totalRuns: (n: number) => `${n} ${n === 1 ? "course" : "courses"}`,
    none: "—"
  },
  ar: {
    title: "أرقامك القياسية",
    personalBests: "أفضل الأرقام الشخصية",
    longest: "أطول جري",
    fastestPace: "أسرع وتيرة",
    best5k: "أفضل 5 كم",
    best10k: "أفضل 10 كم",
    streak: "سلسلة الأسابيع",
    weeks: (n: number) => `${n} ${n === 1 ? "أسبوع" : "أسابيع"}`,
    bestStreak: (n: number) => `الأفضل: ${n}`,
    totalDistance: "المسافة الإجمالية",
    totalRuns: (n: number) => `${n} جري`,
    none: "—"
  }
} as const;

function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm || secondsPerKm <= 0) return "—";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RecordsSummary({ records, locale }: { records: RecordsSummary; locale: CoachLocale }) {
  const t = copy[locale];
  if (records.totalRuns === 0) return null;

  const stats = [
    { icon: RouteIcon, label: t.longest, value: records.longestRunKm > 0 ? `${records.longestRunKm.toFixed(1)} km` : t.none },
    { icon: Gauge, label: t.fastestPace, value: records.fastestPace ? `${formatPace(records.fastestPace.seconds)}/km` : t.none },
    { icon: Timer, label: t.best5k, value: records.best5k ? formatDuration(records.best5k.seconds) : t.none },
    { icon: Timer, label: t.best10k, value: records.best10k ? formatDuration(records.best10k.seconds) : t.none }
  ];

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="size-5 text-brand-orange" aria-hidden="true" />
        <h2 className="text-base font-black text-gray-950">{t.title}</h2>
        <span className="ms-auto text-xs font-semibold text-gray-500">
          {records.totalDistanceKm.toFixed(0)} km · {t.totalRuns(records.totalRuns)}
        </span>
      </div>

      {/* Streak — the headline retention number */}
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
        <Flame className="size-6 shrink-0 text-brand-orange" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-950">{t.weeks(records.currentStreakWeeks)}</p>
          <p className="text-xs font-semibold text-gray-500">
            {t.streak} · {t.bestStreak(records.longestStreakWeeks)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <stat.icon className="mb-1.5 size-4 text-brand-teal" aria-hidden="true" />
            <p className="truncate text-lg font-black tabular-nums text-gray-950">{stat.value}</p>
            <p className="truncate text-xs font-semibold text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
