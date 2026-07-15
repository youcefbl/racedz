"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { EVENT_REGISTRATION_STATUS_LABELS, RACE_TYPE_LABELS } from "@/lib/races";
import type { Locale } from "@/lib/i18n";
import type { EventRegistrationStatus, RaceType } from "@/types/race";
import { cn } from "@/lib/utils";

type RaceSearchFormProps = {
  q?: string;
  wilaya?: string;
  type?: RaceType;
  distance?: string;
  registrationStatus?: EventRegistrationStatus;
  lang?: Locale;
  filtersLabel?: string;
  // When true (e.g. the home hero), render only the keyword + submit and hide
  // the wilaya/type/distance/status filter controls. Defaults to false so
  // /races keeps the full filter grid.
  hideFilters?: boolean;
  labels?: {
    keyword: string;
    keywordLabel: string;
    allWilayas: string;
    wilayaLabel: string;
    allTypes: string;
    typeLabel: string;
    anyDistance: string;
    distanceLabel: string;
    anyStatus: string;
    statusLabel: string;
    submit: string;
  };
};

const distances = ["5", "10", "21.1", "25", "42", "50"];

const defaultLabels = {
  keyword: "Race, city, organizer",
  keywordLabel: "Search",
  allWilayas: "All wilayas",
  wilayaLabel: "Wilaya",
  allTypes: "All race types",
  typeLabel: "Race type",
  anyDistance: "Any distance",
  distanceLabel: "Distance",
  anyStatus: "Any status",
  statusLabel: "Status",
  submit: "Search"
};

export function RaceSearchForm({
  q,
  wilaya,
  type,
  distance,
  registrationStatus,
  filtersLabel = "Filters",
  hideFilters = false,
  labels = defaultLabels
}: RaceSearchFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state mirrors the URL but updates instantly on interaction; an effect
  // re-syncs whenever the server re-renders with new params (e.g. "Clear filters").
  const [keyword, setKeyword] = useState(q ?? "");
  useEffect(() => setKeyword(q ?? ""), [q]);

  // Mobile: filters collapse behind a toggle so results aren't pushed down the page.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [wilaya, type, distance, registrationStatus].filter(Boolean).length;

  function pushParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function submitKeyword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushParam("q", keyword.trim());
  }

  return (
    <form onSubmit={submitKeyword} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <label htmlFor="race-search-q" className="text-xs font-bold text-gray-700">
            {labels.keywordLabel}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              id="race-search-q"
              name="q"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={labels.keyword}
              // Placeholder text is real, readable copy — it needs the same contrast as body
              // text, not the browser default light gray.
              className="h-11 w-full rounded-lg border border-gray-300 ps-9 pe-3 text-sm outline-none placeholder:text-gray-500 focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>
        <div className="flex items-end">
          <button className="h-11 w-full rounded-lg bg-brand-orange px-6 text-sm font-semibold text-white transition hover:bg-brand-orangeDark md:w-auto">
            {labels.submit}
          </button>
        </div>
      </div>
      {hideFilters ? null : (
        <>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition hover:border-brand-teal md:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {filtersLabel}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </span>
            <ChevronDown className={cn("size-4 transition-transform", filtersOpen && "rotate-180")} aria-hidden="true" />
          </button>
          <div className={cn("mt-3 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:grid", filtersOpen ? "grid" : "hidden")}>
        <Field label={labels.wilayaLabel} htmlFor="race-search-wilaya">
          <LiveSelect id="race-search-wilaya" value={wilaya ?? ""} onChange={(value) => pushParam("wilaya", value)}>
            <option value="">{labels.allWilayas}</option>
            {ALGERIA_WILAYAS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </LiveSelect>
        </Field>
        <Field label={labels.typeLabel} htmlFor="race-search-type">
          <LiveSelect id="race-search-type" value={type ?? ""} onChange={(value) => pushParam("type", value)}>
            <option value="">{labels.allTypes}</option>
            {Object.entries(RACE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </LiveSelect>
        </Field>
        <Field label={labels.distanceLabel} htmlFor="race-search-distance">
          <LiveSelect id="race-search-distance" value={distance ?? ""} onChange={(value) => pushParam("distance", value)}>
            <option value="">{labels.anyDistance}</option>
            {distances.map((item) => (
              <option key={item} value={item}>
                {item}K
              </option>
            ))}
          </LiveSelect>
        </Field>
        <Field label={labels.statusLabel} htmlFor="race-search-status">
          <LiveSelect id="race-search-status" value={registrationStatus ?? ""} onChange={(value) => pushParam("registrationStatus", value)}>
            <option value="">{labels.anyStatus}</option>
            {Object.entries(EVENT_REGISTRATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </LiveSelect>
        </Field>
          </div>
        </>
      )}
    </form>
  );
}

// A select that applies instantly on change (live filtering) while staying controlled.
function LiveSelect({
  id,
  value,
  onChange,
  children
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <select
      id={id}
      value={local}
      onChange={(event) => {
        setLocal(event.target.value);
        onChange(event.target.value);
      }}
      className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
    >
      {children}
    </select>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-bold text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}
