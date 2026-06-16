"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { registerAction, type RegisterActionState } from "./actions";

const initialState: RegisterActionState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {state.error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" autoComplete="given-name" />
        <Field label="Last name" name="lastName" autoComplete="family-name" />
        <Field label="Arabic full name" name="arabicFullName" required={false} />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} />
        <Field label="Date of birth" name="dateOfBirth" type="date" required={false} />
        <Field label="ID number" name="nationalId" required={false} />
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          Wilaya
          <select
            name="wilaya"
            required
            className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            {ALGERIA_WILAYAS.map((wilaya) => (
              <option key={wilaya} value={wilaya}>
                {wilaya}
              </option>
            ))}
          </select>
        </label>
        <Field label="City" name="city" />
        <Field label="Commune" name="commune" required={false} />
      </div>
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
  minLength
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
