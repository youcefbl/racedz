"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, ImageIcon, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { type ProfileActionState, updateProfileAction } from "./actions";

const initialState: ProfileActionState = {};

type ProfileFormProps = {
  user: {
    email: string;
    firstName: string;
    lastName: string;
    arabicFullName?: string | null;
    phone?: string | null;
    gender?: string | null;
    dateOfBirth?: Date | null;
    nationalId?: string | null;
    avatarUrl?: string | null;
    wilaya?: string | null;
    city?: string | null;
    commune?: string | null;
  };
};

export function ProfileForm({ user }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.success}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserRound className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Identity</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" defaultValue={user.firstName} autoComplete="given-name" />
          <Field label="Last name" name="lastName" defaultValue={user.lastName} autoComplete="family-name" />
          <Field label="Arabic full name" name="arabicFullName" defaultValue={user.arabicFullName ?? ""} required={false} />
          <Field label="Phone" name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" />
          <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={formatInputDate(user.dateOfBirth)} required={false} />
          <Field label="ID number" name="nationalId" defaultValue={user.nationalId ?? ""} required={false} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Gender
            <select
              name="gender"
              defaultValue={user.gender ?? ""}
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Not specified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Account email
            <input
              value={user.email}
              readOnly
              className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 font-normal text-gray-500 outline-none"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Location</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Wilaya
            <select
              name="wilaya"
              defaultValue={user.wilaya ?? "Alger"}
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              {ALGERIA_WILAYAS.map((wilaya) => (
                <option key={wilaya} value={wilaya}>
                  {wilaya}
                </option>
              ))}
            </select>
          </label>
          <Field label="City" name="city" defaultValue={user.city ?? ""} />
          <Field label="Commune" name="commune" defaultValue={user.commune ?? ""} required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Avatar</h2>
        </div>
        <Field label="Avatar image URL" name="avatarUrl" type="url" defaultValue={user.avatarUrl ?? ""} required={false} />
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving profile..." : "Save profile settings"}
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
  defaultValue = ""
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function formatInputDate(value?: Date | null) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}
