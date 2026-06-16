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
    allWilayas: string;
    allTypes: string;
    anyDistance: string;
    anyStatus: string;
    submit: string;
  };
};

const distances = ["5", "10", "21.1", "25", "42", "50"];

const defaultLabels = {
  keyword: "Race, city, organizer",
  allWilayas: "All wilayas",
  allTypes: "All race types",
  anyDistance: "Any distance",
  anyStatus: "Any status",
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
    <form action="/races" className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
      {lang && lang !== "en" ? <input type="hidden" name="lang" value={lang} /> : null}
      <label className="relative">
        <span className="sr-only">Search races</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          name="q"
          defaultValue={q}
          placeholder={labels.keyword}
          className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
        />
      </label>
      <label>
        <span className="sr-only">Wilaya</span>
        <select
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
      </label>
      <label>
        <span className="sr-only">Race type</span>
        <select
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
      </label>
      <label>
        <span className="sr-only">Distance</span>
        <select
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
      </label>
      <label>
        <span className="sr-only">Registration status</span>
        <select
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
      </label>
      <button className="h-11 rounded-lg bg-brand-orange px-5 text-sm font-semibold text-white transition hover:bg-brand-orangeDark">
        {labels.submit}
      </button>
    </form>
  );
}
