"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token, locale }: { token: string; locale: Locale }) {
  const t = getDictionary(locale).auth;
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={locale} />
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
      </div>
      <label className="grid gap-2 text-sm font-semibold text-gray-800">
        {t.resetNewPassword}
        <span className="relative">
          <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            className="h-11 w-full rounded-lg border border-gray-300 ps-9 pe-11 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
          <button
            type="button"
            aria-label={showPassword ? t.hidePassword : t.showPassword}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute end-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </span>
        {state.fieldErrors?.password ? <span className="text-xs font-semibold text-red-700">{state.fieldErrors.password}</span> : null}
        <span className="text-xs font-normal text-gray-500">{t.passwordHint}</span>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-gray-800">
        {t.resetConfirm}
        <span className="relative">
          <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            className="h-11 w-full rounded-lg border border-gray-300 ps-9 pe-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </span>
        {state.fieldErrors?.confirmPassword ? (
          <span className="text-xs font-semibold text-red-700">{state.fieldErrors.confirmPassword}</span>
        ) : null}
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.forgotSending : t.resetSubmit}
      </Button>
    </form>
  );
}
