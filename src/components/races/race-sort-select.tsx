"use client";

import { ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Result ordering for the race list. Writes the `sort` query param (omitting it for
// the default "date") so the order is shareable and survives reloads. Works on web + app.
export function RaceSortSelect({
  label,
  options
}: {
  label: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "date";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "date") params.delete("sort");
    else params.set("sort", value);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-700">
      <span className="sr-only">{label}</span>
      <ArrowUpDown className="size-4 text-gray-500" aria-hidden="true" />
      <select
        value={current}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-11 rounded-lg border border-gray-300 bg-white px-2 text-sm font-semibold text-gray-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
