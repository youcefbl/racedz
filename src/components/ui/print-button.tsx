"use client";

import { Printer } from "lucide-react";

// Triggers the browser print dialog (Save-as-PDF). Hidden when the page itself is printed.
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-teal px-5 text-sm font-black text-white shadow-sm transition hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal print:hidden"
    >
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
