"use client";

import { Heart, Users } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { FollowButton } from "@/components/social/follow-button";
import type { CoachLocale } from "@/components/coach/types";
import type { FeedRun } from "@/lib/social";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    title: "Feed",
    intro: "Runs from people you follow.",
    emptyTitle: "Your feed is quiet",
    emptyText: "Follow runners from the leaderboards, or record a run — your own runs show here too.",
    loadMore: "Load more",
    you: "You",
    km: "km"
  },
  fr: {
    title: "Fil",
    intro: "Les sorties des personnes que vous suivez.",
    emptyTitle: "Votre fil est vide",
    emptyText: "Suivez des coureurs depuis les classements, ou enregistrez une sortie — les vôtres apparaîtront aussi ici.",
    loadMore: "Voir plus",
    you: "Vous",
    km: "km"
  },
  ar: {
    title: "الموجز",
    intro: "جريات الأشخاص الذين تتابعهم.",
    emptyTitle: "موجزك فارغ",
    emptyText: "تابع عدّائين من لوحات الصدارة، أو سجّل جريًا — وستظهر جرياتك هنا أيضًا.",
    loadMore: "تحميل المزيد",
    you: "أنت",
    km: "كم"
  }
} as const;

function formatPace(secondsPerKm: number): string {
  if (!secondsPerKm || secondsPerKm <= 0) return "—";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

function formatDate(iso: string, locale: CoachLocale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar" : locale, { month: "short", day: "numeric" });
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" decoding="async" className="size-10 shrink-0 rounded-full object-cover" />;
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-black text-brand-teal">
      {initials || "R"}
    </span>
  );
}

function KudosButton({ run, locale }: { run: FeedRun; locale: CoachLocale }) {
  const [kudoed, setKudoed] = useState(run.hasKudoed);
  const [count, setCount] = useState(run.kudosCount);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !kudoed;
    setKudoed(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      try {
        const res = await fetch("/api/social/kudos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ runId: run.id })
        });
        const json = (await res.json().catch(() => null)) as { data?: { kudoed: boolean; count: number } } | null;
        if (json?.data) {
          setKudoed(json.data.kudoed);
          setCount(json.data.count);
        } else {
          setKudoed(!next);
          setCount((c) => c + (next ? -1 : 1));
        }
      } catch {
        setKudoed(!next);
        setCount((c) => c + (next ? -1 : 1));
      }
    });
  };

  // Voice: kudos on your own run is meaningful too (Strava allows it), so no self-guard.
  const label = locale === "ar" ? "إعجاب" : locale === "fr" ? "Bravo" : "Kudos";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={kudoed}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black tabular-nums text-gray-600 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60"
    >
      <Heart className={cn("size-4", kudoed ? "fill-red-500 text-red-500" : "text-gray-400")} aria-hidden="true" />
      {count}
    </button>
  );
}

export function FeedView({
  initialRuns,
  initialCursor,
  locale
}: {
  initialRuns: FeedRun[];
  initialCursor: string | null;
  locale: CoachLocale;
}) {
  const t = copy[locale];
  const rtl = locale === "ar";
  const [runs, setRuns] = useState<FeedRun[]>(initialRuns);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/social/feed?cursor=${encodeURIComponent(cursor)}`, { headers: { accept: "application/json" } });
      const json = (await res.json().catch(() => null)) as { data?: FeedRun[]; meta?: { nextCursor: string | null } } | null;
      if (json?.data) {
        setRuns((prev) => [...prev, ...json.data!]);
        setCursor(json.meta?.nextCursor ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-4">
        <h1 className="text-2xl font-black text-gray-950">{t.title}</h1>
        <p className="text-sm font-semibold text-gray-500">{t.intro}</p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-50 text-brand-teal">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-base font-black text-gray-950">{t.emptyTitle}</p>
          <p className="mt-1 text-sm font-semibold text-gray-500">{t.emptyText}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => (
            <li key={run.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar name={run.authorName} url={run.authorAvatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-gray-950">{run.isOwn ? t.you : run.authorName}</p>
                  <p className="truncate text-xs font-semibold text-gray-500">
                    {(run.authorWilaya ?? "—")} · {formatDate(run.startedAt, locale)}
                  </p>
                </div>
                {!run.isOwn ? <FollowButton userId={run.userId} initialFollowing locale={locale} /> : null}
              </div>

              {run.title ? <p className="mt-3 text-sm font-bold text-gray-800">{run.title}</p> : null}

              <div className="mt-3 flex items-center gap-4">
                <div>
                  <p className="text-lg font-black tabular-nums text-gray-950">
                    {run.distanceKm.toFixed(1)} <span className="text-xs font-bold text-gray-500">{t.km}</span>
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black tabular-nums text-brand-teal">{formatPace(run.averagePaceSecondsPerKm)}</p>
                </div>
                <span className="grow" />
                <KudosButton run={run} locale={locale} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex min-h-11 items-center rounded-full border border-gray-200 bg-white px-5 text-sm font-black text-brand-teal shadow-sm transition hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60"
          >
            {t.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  );
}
