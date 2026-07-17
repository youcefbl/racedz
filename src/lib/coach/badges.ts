// Achievements / badges — computed on read from data the app already has (runs, personal records,
// race finishes). No award pipeline or storage: a badge is "earned" the moment the underlying number
// crosses its threshold, so it can never drift out of sync with reality. Locked badges carry their
// progress so the UI can show "3 / 10" and give the runner something to chase between races.

export type BadgeCategory = "VOLUME" | "DISTANCE" | "CONSISTENCY" | "RACING";

export type Badge = {
  id: string;
  category: BadgeCategory;
  current: number; // the runner's current value on this badge's metric
  target: number; // threshold to earn it
  earned: boolean;
};

export type BadgeInput = {
  totalRuns: number;
  totalDistanceKm: number;
  longestStreakWeeks: number;
  raceFinishes: number;
  runsAt10k: number;
  runsAtHalf: number;
  runsAtMarathon: number;
};

type CatalogEntry = { id: string; category: BadgeCategory; metric: keyof BadgeInput; target: number };

// Ordered easiest → hardest within each category. IDs are stable (the UI maps them to labels/icons).
const CATALOG: CatalogEntry[] = [
  { id: "first_run", category: "VOLUME", metric: "totalRuns", target: 1 },
  { id: "runs_10", category: "VOLUME", metric: "totalRuns", target: 10 },
  { id: "runs_50", category: "VOLUME", metric: "totalRuns", target: 50 },
  { id: "runs_100", category: "VOLUME", metric: "totalRuns", target: 100 },

  { id: "dist_50", category: "DISTANCE", metric: "totalDistanceKm", target: 50 },
  { id: "dist_250", category: "DISTANCE", metric: "totalDistanceKm", target: 250 },
  { id: "dist_1000", category: "DISTANCE", metric: "totalDistanceKm", target: 1000 },

  // Landmark distances count *completed* runs at that distance (see runsAt* in records.ts), so an
  // unearned one honestly reads 0/1. Every target here is a whole number of things done — never a
  // partial measurement — which is what makes the bare "3/4" progress text safe to read.
  { id: "long_10k", category: "DISTANCE", metric: "runsAt10k", target: 1 },
  { id: "long_half", category: "DISTANCE", metric: "runsAtHalf", target: 1 },
  { id: "long_marathon", category: "DISTANCE", metric: "runsAtMarathon", target: 1 },

  { id: "streak_4", category: "CONSISTENCY", metric: "longestStreakWeeks", target: 4 },
  { id: "streak_12", category: "CONSISTENCY", metric: "longestStreakWeeks", target: 12 },
  { id: "streak_26", category: "CONSISTENCY", metric: "longestStreakWeeks", target: 26 },

  { id: "race_1", category: "RACING", metric: "raceFinishes", target: 1 },
  { id: "race_5", category: "RACING", metric: "raceFinishes", target: 5 }
];

export function computeBadges(input: BadgeInput): Badge[] {
  return CATALOG.map((entry) => {
    const current = input[entry.metric];
    return {
      id: entry.id,
      category: entry.category,
      current,
      target: entry.target,
      earned: current >= entry.target
    };
  });
}

export function earnedBadgeCount(badges: Badge[]): number {
  return badges.filter((badge) => badge.earned).length;
}
