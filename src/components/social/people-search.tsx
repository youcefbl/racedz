"use client";

import { Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FollowButton } from "@/components/social/follow-button";
import type { CoachLocale } from "@/components/coach/types";
import type { RunnerSearchResult } from "@/lib/social";

const copy = {
  en: {
    label: "Find people",
    placeholder: "Search runners by name…",
    empty: "No runners match that name.",
    hint: "Type at least 2 letters.",
    clear: "Clear search"
  },
  fr: {
    label: "Trouver des coureurs",
    placeholder: "Rechercher un coureur par nom…",
    empty: "Aucun coureur ne correspond à ce nom.",
    hint: "Tapez au moins 2 lettres.",
    clear: "Effacer la recherche"
  },
  ar: {
    label: "ابحث عن أشخاص",
    placeholder: "ابحث عن عدّاء بالاسم…",
    empty: "لا يوجد عدّاؤون بهذا الاسم.",
    hint: "اكتب حرفين على الأقل.",
    clear: "مسح البحث"
  }
} as const;

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={36} height={36} loading="lazy" decoding="async" className="size-9 shrink-0 rounded-full object-cover" />;
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-black text-brand-teal">
      {initials || "R"}
    </span>
  );
}

// Debounced runner-name search with an inline Follow button per result. Self-contained: the
// Feed screen was the only place in the app someone could discover new people to follow
// (previously only the /rankings leaderboards offered a Follow button, and nothing let a runner
// search by name at all).
export function PeopleSearch({ locale }: { locale: CoachLocale }) {
  const t = copy[locale];
  const rtl = locale === "ar";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RunnerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void fetch(`/api/social/search?q=${encodeURIComponent(trimmed)}`, { headers: { accept: "application/json" } })
        .then((res) => res.json().catch(() => null))
        .then((json: { data?: RunnerSearchResult[] } | null) => {
          if (requestId.current !== id) return; // a newer keystroke's request already landed
          setResults(json?.data ?? []);
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" dir={rtl ? "rtl" : "ltr"}>
      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-gray-500">{t.label}</span>
        <span className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.placeholder}
            className="h-11 w-full rounded-lg border border-gray-300 bg-white ps-9 pe-9 text-sm font-semibold text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.clear}
              className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </label>

      {query.trim().length > 0 && query.trim().length < 2 ? <p className="mt-2 text-xs font-semibold text-gray-400">{t.hint}</p> : null}

      {loading ? (
        <p className="mt-3 text-xs font-semibold text-gray-400">…</p>
      ) : query.trim().length >= 2 && results.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
          <Users className="size-4 shrink-0" aria-hidden="true" />
          {t.empty}
        </div>
      ) : results.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {results.map((person) => (
            <li key={person.userId} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2">
              <Avatar name={person.name} url={person.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-gray-950">{person.name}</p>
                {person.wilaya ? <p className="truncate text-xs font-semibold text-gray-500">{person.wilaya}</p> : null}
              </div>
              <FollowButton userId={person.userId} initialFollowing={person.isFollowing} locale={locale} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
