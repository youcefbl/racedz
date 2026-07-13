"use client";

import { useActionState, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { registerAction, type RegisterActionState } from "./actions";

const initialState: RegisterActionState = {};

export function RegisterForm({ callbackUrl, locale }: { callbackUrl?: string; locale: Locale }) {
  const t = getDictionary(locale).auth;
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <input type="hidden" name="lang" value={locale} />
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        ) : null}
      </div>
      <Section
        icon={UserRound}
        title={t.yourName}
        description={t.yourNameSub}
      >
        <Field label={t.firstName} name="firstName" autoComplete="given-name" defaultValue={state.values?.firstName} error={state.fieldErrors?.firstName} />
        <Field label={t.lastName} name="lastName" autoComplete="family-name" defaultValue={state.values?.lastName} error={state.fieldErrors?.lastName} />
      </Section>

      <Section icon={LockKeyhole} title={t.loginSecurity} description={t.loginSecuritySub} cols={1}>
        <Field label={t.emailLabel} name="email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
        <Field
          label={t.passwordLabel}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={state.fieldErrors?.password}
          hint={t.passwordHint}
          trailingControl={
            <PasswordToggle
              pressed={showPassword}
              label={showPassword ? t.hidePassword : t.showPassword}
              onClick={() => setShowPassword((value) => !value)}
            />
          }
        />
        <Field
          label={t.confirmPassword}
          name="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={state.fieldErrors?.confirmPassword ?? (passwordMismatch ? t.passwordMismatch : undefined)}
          trailingControl={
            <PasswordToggle
              pressed={showConfirmPassword}
              label={showConfirmPassword ? t.hideConfirmPassword : t.showConfirmPassword}
              onClick={() => setShowConfirmPassword((value) => !value)}
            />
          }
        />
      </Section>

      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm font-semibold text-brand-teal">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t.registerFootnote}
      </p>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.creatingAccount : t.createAccount}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  autoComplete,
  minLength,
  defaultValue,
  value,
  onChange,
  error,
  hint,
  trailingControl
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  defaultValue?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  trailingControl?: ReactNode;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
      <span className="relative">
        <input
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          {...(value !== undefined ? { value, onChange } : { defaultValue })}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50 ${trailingControl ? "pe-11" : ""}`}
        />
        {trailingControl}
      </span>
      {hint ? <span id={hintId} className="text-xs font-semibold text-gray-500">{hint}</span> : null}
      {error ? <span id={errorId} className="text-xs font-semibold text-red-600">{error}</span> : null}
    </label>
  );
}

function PasswordToggle({
  pressed,
  label,
  onClick
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = pressed ? EyeOff : Eye;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="absolute end-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  cols = 2,
  children
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  cols?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-black text-gray-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
        </div>
      </div>
      <div className={`grid gap-4 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
    </section>
  );
}
