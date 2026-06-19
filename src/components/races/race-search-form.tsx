import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { EVENT_REGISTRATION_STATUS_LABELS, RACE_TYPE_LABELS } from "@/lib/races";
import type { Locale } from "@/lib/i18n";
import type { EventRegistrationStatus, RaceType } from "@/types/race";

type RaceSearchFormProps = {
  q?: string;
  wilaya?: string;
  type?: RaceType;
  distance?: string;
  registrationStatus?: EventRegistrationStatus;
  lang?: Locale;
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
  lang,
  labels = defaultLabels
}: RaceSearchFormProps) {
  return (
    <form action="/races" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {lang && lang !== "en" ? <input type="hidden" name="lang" value={lang} /> : null}
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <label htmlFor="race-search-q" className="text-xs font-bold text-gray-700">
            {labels.keywordLabel}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              id="race-search-q"
              name="q"
              defaultValue={q}
              placeholder={labels.keyword}
              className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>
        <div className="flex items-end">
          <button className="h-11 w-full rounded-lg bg-brand-orange px-6 text-sm font-semibold text-white transition hover:bg-brand-orangeDark md:w-auto">
            {labels.submit}
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={labels.wilayaLabel} htmlFor="race-search-wilaya">
          <select
            id="race-search-wilaya"
            name="wilaya"
            defaultValue={wilaya ?? ""}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            <option value="">{labels.allWilayas}</option>
            {ALGERIA_WILAYAS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label={labels.typeLabel} htmlFor="race-search-type">
          <select
            id="race-search-type"
            name="type"
            defaultValue={type ?? ""}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            <option value="">{labels.allTypes}</option>
            {Object.entries(RACE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={labels.distanceLabel} htmlFor="race-search-distance">
          <select
            id="race-search-distance"
            name="distance"
            defaultValue={distance ?? ""}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            <option value="">{labels.anyDistance}</option>
            {distances.map((item) => (
              <option key={item} value={item}>
                {item}K
              </option>
            ))}
          </select>
        </Field>
        <Field label={labels.statusLabel} htmlFor="race-search-status">
          <select
            id="race-search-status"
            name="registrationStatus"
            defaultValue={registrationStatus ?? ""}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            <option value="">{labels.anyStatus}</option>
            {Object.entries(EVENT_REGISTRATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </form>
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
