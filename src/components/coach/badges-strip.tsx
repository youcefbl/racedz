"use client";

import { Award, Flame, Footprints, Medal, Mountain, Route as RouteIcon, Trophy, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { Badge } from "@/lib/coach/badges";
import type { CoachLocale } from "@/components/coach/types";
import { cn } from "@/lib/utils";

const HEADING = {
  en: {
    title: "Achievements",
    of: (a: number, b: number) => `${a} of ${b}`,
    showAll: "Show all",
    showLess: "Show less",
    longestRun: "Longest run"
  },
  fr: {
    title: "Trophées",
    of: (a: number, b: number) => `${a} sur ${b}`,
    showAll: "Tout voir",
    showLess: "Réduire",
    longestRun: "Plus longue sortie"
  },
  ar: {
    title: "الإنجازات",
    of: (a: number, b: number) => `${a} من ${b}`,
    showAll: "عرض الكل",
    showLess: "عرض أقل",
    longestRun: "أطول حصة جري"
  }
} as const;

const META: Record<string, { icon: LucideIcon; label: Record<CoachLocale, string> }> = {
  first_run: { icon: Footprints, label: { en: "First run", fr: "Première sortie", ar: "أول حصة جري" } },
  runs_10: { icon: Footprints, label: { en: "10 runs", fr: "10 sorties", ar: "10 حصص جري" } },
  runs_50: { icon: Footprints, label: { en: "50 runs", fr: "50 sorties", ar: "50 حصة جري" } },
  runs_100: { icon: Award, label: { en: "100 runs", fr: "100 sorties", ar: "100 حصة جري" } },
  dist_50: { icon: RouteIcon, label: { en: "50 km total", fr: "50 km au total", ar: "50 كم إجمالاً" } },
  dist_250: { icon: RouteIcon, label: { en: "250 km total", fr: "250 km au total", ar: "250 كم إجمالاً" } },
  dist_1000: { icon: Award, label: { en: "1000 km total", fr: "1000 km au total", ar: "1000 كم إجمالاً" } },
  long_10k: { icon: RouteIcon, label: { en: "10K run", fr: "Course de 10 km", ar: "جري 10 كم" } },
  long_half: { icon: Mountain, label: { en: "Half marathon", fr: "Semi-marathon", ar: "نصف ماراثون" } },
  long_marathon: { icon: Mountain, label: { en: "Marathon", fr: "Marathon", ar: "ماراثون" } },
  streak_4: { icon: Flame, label: { en: "4-week streak", fr: "Série de 4 semaines", ar: "سلسلة 4 أسابيع" } },
  streak_12: { icon: Flame, label: { en: "12-week streak", fr: "Série de 12 semaines", ar: "سلسلة 12 أسبوعًا" } },
  streak_26: { icon: Flame, label: { en: "26-week streak", fr: "Série de 26 semaines", ar: "سلسلة 26 أسبوعًا" } },
  race_1: { icon: Medal, label: { en: "Race finisher", fr: "Finisher", ar: "أتمّ سباقًا" } },
  race_5: { icon: Trophy, label: { en: "5 races", fr: "5 courses", ar: "5 سباقات" } }
};

// Floor, never round: a locked badge must not display as already complete. 49.7 km toward the
// 50 km badge reads "49/50", not the "50/50"-but-still-grey that rounding produced.
function formatValue(value: number): string {
  return String(Math.floor(value));
}

// A measurement, not a goal — no target, no locked state, just the runner's current best. Kept out
// of the `badges` array so it can't skew the "2 of 15" earned count with a never-earnable tile.
function LongestRunTile({ km, locale }: { km: number; locale: CoachLocale }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-3 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-gray-100 text-brand-teal">
        <RouteIcon className="size-5" aria-hidden="true" />
      </span>
      <span className="text-[11px] font-black leading-tight text-gray-500">{HEADING[locale].longestRun}</span>
      <span className="text-[10px] font-bold tabular-nums text-gray-700">{km.toFixed(1)} km</span>
    </div>
  );
}

function BadgeTile({ badge, locale }: { badge: Badge; locale: CoachLocale }) {
  const meta = META[badge.id];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center",
        badge.earned ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full",
          badge.earned ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className={cn("text-[11px] font-black leading-tight", badge.earned ? "text-amber-900" : "text-gray-500")}>
        {meta.label[locale]}
      </span>
      {!badge.earned ? (
        <span className="text-[10px] font-bold tabular-nums text-gray-400">
          {formatValue(badge.current)}/{formatValue(badge.target)}
        </span>
      ) : null}
    </div>
  );
}

const COLLAPSED_TILES = 8;

export function BadgesStrip({
  badges,
  longestRunKm = 0,
  locale
}: {
  badges: Badge[];
  longestRunKm?: number;
  locale: CoachLocale;
}) {
  const t = HEADING[locale];
  const [expanded, setExpanded] = useState(false);
  if (badges.length === 0) return null;

  // Only worth a tile once there's a run behind it.
  const showLongestRun = longestRunKm > 0;
  const earnedCount = badges.filter((b) => b.earned).length;
  // Collapsed: earned badges first, then the next few to chase. The longest-run stat takes one of
  // the collapsed slots, so the grid stays a clean 8 either way.
  const ordered = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned));
  const badgeSlots = showLongestRun ? COLLAPSED_TILES - 1 : COLLAPSED_TILES;
  const shown = expanded ? ordered : ordered.slice(0, badgeSlots);

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Award className="size-5 text-amber-500" aria-hidden="true" />
        <h2 className="text-base font-black text-gray-950">{t.title}</h2>
        <span className="ms-auto text-xs font-semibold text-gray-500">{t.of(earnedCount, badges.length)}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {showLongestRun ? <LongestRunTile km={longestRunKm} locale={locale} /> : null}
        {shown.map((badge) => (
          <BadgeTile key={badge.id} badge={badge} locale={locale} />
        ))}
      </div>
      {badges.length > shown.length ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full text-center text-xs font-black text-brand-teal hover:underline"
        >
          {expanded ? t.showLess : t.showAll}
        </button>
      ) : null}
    </div>
  );
}
