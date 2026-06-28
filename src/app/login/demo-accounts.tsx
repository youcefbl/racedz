"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import { tapHaptic } from "@/lib/native/haptics";
import { cn } from "@/lib/utils";

const PASSWORD = "racedz-demo-password";

// The native app disables text selection app-wide for feel, which made these uncopyable.
// Tap-to-copy buttons fix that on mobile; the values stay selectable as a fallback.
export function DemoAccounts({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth;
  const demo = [
    { role: t.roleRunner, email: "runner@example.com" },
    { role: t.roleOrganizer, email: "organizer@zidrun.com" }
  ];

  return (
    <div className="mt-5 rounded-lg bg-gray-50 p-4">
      <p className="text-sm font-bold text-gray-950">{t.demoAccounts}</p>
      <div className="mt-3 grid gap-2 text-xs text-gray-600">
        {demo.map((acct) => (
          <div key={acct.email} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
            <span className="font-semibold text-gray-950">{acct.role}</span>
            <CopyValue value={acct.email} labels={t} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs">
        <span className="font-semibold text-gray-950">{t.passwordLabel}</span>
        <CopyValue value={PASSWORD} labels={t} />
      </div>
    </div>
  );
}

function CopyValue({ value, labels }: { value: string; labels: ReturnType<typeof getDictionary>["auth"] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    tapHaptic("light");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the text is still selectable as a fallback */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "rz-selectable inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-gray-700 transition active:scale-95",
        copied ? "text-brand-teal" : "hover:bg-gray-100"
      )}
      aria-label={copied ? labels.copied : labels.copyValue.replace("{value}", value)}
    >
      <span>{value}</span>
      {copied ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <Copy className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />}
    </button>
  );
}
