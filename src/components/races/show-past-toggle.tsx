"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tapHaptic } from "@/lib/native/haptics";
import { cn } from "@/lib/utils";

// Past (completed) races are hidden by default. This switch opts back into them by
// toggling the `past` query param, preserving every other active filter. Works on web + app.
export function ShowPastToggle({ label }: { label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const on = searchParams.get("past") === "1";

  function toggle() {
    tapHaptic("light");
    const params = new URLSearchParams(searchParams.toString());
    if (on) params.delete("past");
    else params.set("past", "1");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-brand-teal" : "bg-gray-300"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow transition-transform",
            on ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
      {label}
    </button>
  );
}
