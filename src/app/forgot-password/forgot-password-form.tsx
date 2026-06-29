"use client";

import { useActionState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth;
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        <CheckCircle2 className="mb-2 size-6" aria-hidden="true" />
        <p className="font-semibold">{t.forgotSentTitle}</p>
        <p className="mt-1 leading-6">{t.forgotSentText}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="lang" value={locale} />
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
      </div>
      <label className="grid gap-2 text-sm font-semibold text-gray-800">
        {t.emailLabel}
        <span className="relative">
          <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            required
            className="h-11 w-full rounded-lg border border-gray-300 ps-9 pe-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </span>
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.forgotSending : t.forgotSubmit}
      </Button>
    </form>
  );
}
