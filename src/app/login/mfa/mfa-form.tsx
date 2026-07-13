"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { completeMfaAction, type MfaChallengeState } from "../actions";

const initialState: MfaChallengeState = {};

export function MfaChallengeForm({ ticket, locale }: { ticket: string; locale: Locale }) {
  const t = getDictionary(locale).auth;
  const [state, formAction, pending] = useActionState(completeMfaAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="ticket" value={ticket} />
      <input type="hidden" name="lang" value={locale} />
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>
        ) : null}
      </div>
      <label className="grid gap-2 text-sm font-semibold text-gray-800">
        {t.mfaCodeLabel}
        <span className="relative">
          <ShieldCheck className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t.mfaCodePlaceholder}
            autoFocus
            required
            className="h-11 w-full rounded-lg border border-gray-300 ps-9 pe-3 font-normal tracking-widest outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </span>
        <span className="text-xs font-normal text-gray-500">{t.mfaPrompt}</span>
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.signingIn : t.mfaVerify}
      </Button>
    </form>
  );
}
