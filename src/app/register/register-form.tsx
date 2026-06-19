"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, LockKeyhole, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { registerAction, type RegisterActionState } from "./actions";

const initialState: RegisterActionState = {};

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}
      <Section
        icon={UserRound}
        title="Personal details"
        description="Use the same identity details you will use for race registrations."
      >
        <Field label="First name" name="firstName" autoComplete="given-name" defaultValue={state.values?.firstName} error={state.fieldErrors?.firstName} />
        <Field label="Last name" name="lastName" autoComplete="family-name" defaultValue={state.values?.lastName} error={state.fieldErrors?.lastName} />
        <Field
          label="Arabic full name"
          name="arabicFullName"
          required={false}
          defaultValue={state.values?.arabicFullName}
          error={state.fieldErrors?.arabicFullName}
        />
        <Field label="Date of birth" name="dateOfBirth" type="date" required={false} defaultValue={state.values?.dateOfBirth} error={state.fieldErrors?.dateOfBirth} />
        <Field label="ID number" name="nationalId" required={false} defaultValue={state.values?.nationalId} error={state.fieldErrors?.nationalId} />
        <Field label="Phone" name="phone" type="tel" autoComplete="tel" defaultValue={state.values?.phone} error={state.fieldErrors?.phone} />
      </Section>

      <Section icon={MapPin} title="Location" description="This helps RaceDZ show local races and prefill registration forms.">
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          Wilaya
          <select
            name="wilaya"
            required
            defaultValue={state.values?.wilaya}
            aria-invalid={Boolean(state.fieldErrors?.wilaya)}
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50"
          >
            <option value="">Choose wilaya</option>
            {ALGERIA_WILAYAS.map((wilaya) => (
              <option key={wilaya} value={wilaya}>
                {wilaya}
              </option>
            ))}
          </select>
          {state.fieldErrors?.wilaya ? <span className="text-xs font-semibold text-red-600">{state.fieldErrors.wilaya}</span> : null}
        </label>
        <Field label="Commune" name="commune" required={false} defaultValue={state.values?.commune} error={state.fieldErrors?.commune} />
      </Section>

      <Section icon={LockKeyhole} title="Login security" description="You will need to verify your email before logging in.">
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} />
        <Field
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          error={state.fieldErrors?.password}
          hint="Use at least 8 characters with a letter and a number."
          trailingControl={
            <PasswordToggle
              pressed={showPassword}
              label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            />
          }
        />
        <Field
          label="Confirm password"
          name="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          error={state.fieldErrors?.confirmPassword}
          trailingControl={
            <PasswordToggle
              pressed={showConfirmPassword}
              label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
              onClick={() => setShowConfirmPassword((value) => !value)}
            />
          }
        />
      </Section>

      <p className="flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-sm font-semibold text-brand-teal">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        After signup, check your email for the activation link.
      </p>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
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
  error?: string;
  hint?: string;
  trailingControl?: ReactNode;
}) {
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
          defaultValue={defaultValue}
          aria-invalid={Boolean(error)}
          className={`h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50 ${trailingControl ? "pr-11" : ""}`}
        />
        {trailingControl}
      </span>
      {hint ? <span className="text-xs font-semibold text-gray-500">{hint}</span> : null}
      {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
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
      className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
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
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
