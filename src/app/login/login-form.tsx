"use client";

import Link from "next/link";
import { Eye, EyeOff, Mail, LockKeyhole } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = {};

export function LoginForm({ callbackUrl, locale }: { callbackUrl?: string; locale: Locale }) {
  const t = getDictionary(locale).auth;
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="grid gap-4">
      {/* Empty when there's no explicit destination, so the server routes by role
          (admins -> /admin, organizers -> /organizer, runners -> /account/registrations). */}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <input type="hidden" name="lang" value={locale} />
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>
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
      <label className="grid gap-2 text-sm font-semibold text-gray-800">
        {t.passwordLabel}
        <span className="relative">
          <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            required
            minLength={6}
            className="h-11 w-full rounded-lg border border-gray-300 ps-9 pe-11 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
          <button
            type="button"
            aria-label={showPassword ? t.hidePassword : t.showPassword}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute end-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </span>
      </label>
      <div className="-mt-1 flex justify-end">
        <Link href={withLocale("/forgot-password", locale)} className="text-sm font-semibold text-brand-teal hover:underline">
          {t.forgotLink}
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.signingIn : t.login}
      </Button>
    </form>
  );
}
