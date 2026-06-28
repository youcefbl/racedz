"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, ImageIcon, MapPin, UserRound } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { getDictionary, type Locale } from "@/lib/i18n";
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
  locale: Locale;
};

export function ProfileForm({ user, locale }: ProfileFormProps) {
  const dict = getDictionary(locale);
  const t = dict.profile;
  const optionalLabel = dict.ui.optional;
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="lang" value={locale} />
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
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
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserRound className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">{t.identity}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.firstName} name="firstName" defaultValue={user.firstName} autoComplete="given-name" optionalLabel={optionalLabel} />
          <Field label={t.lastName} name="lastName" defaultValue={user.lastName} autoComplete="family-name" optionalLabel={optionalLabel} />
          <Field label={t.arabicName} name="arabicFullName" defaultValue={user.arabicFullName ?? ""} required={false} optionalLabel={optionalLabel} />
          <Field label={t.phone} name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" optionalLabel={optionalLabel} />
          <Field label={t.dateOfBirth} name="dateOfBirth" type="date" defaultValue={formatInputDate(user.dateOfBirth)} required={false} optionalLabel={optionalLabel} />
          <Field label={t.idNumber} name="nationalId" defaultValue={user.nationalId ?? ""} required={false} optionalLabel={optionalLabel} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t.gender}
            <select
              name="gender"
              defaultValue={user.gender ?? ""}
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              <option value="">{t.genderUnspecified}</option>
              <option value="MALE">{t.genderMale}</option>
              <option value="FEMALE">{t.genderFemale}</option>
              <option value="OTHER">{t.genderOther}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t.accountEmail}
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
          <h2 className="text-lg font-black text-gray-950">{t.location}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t.wilaya}
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
          <Field label={t.city} name="city" defaultValue={user.city ?? ""} />
          <Field label={t.commune} name="commune" defaultValue={user.commune ?? ""} required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">{t.avatar}</h2>
        </div>
        <ImageUploadField label={t.avatarImage} name="avatarUrl" scope="avatar" defaultValue={user.avatarUrl} />
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.saving : t.save}
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
  defaultValue = "",
  optionalLabel
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  optionalLabel?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      <span>
        {label}
        {!required && optionalLabel ? (
          <span className="ms-1 font-normal text-gray-500">({optionalLabel})</span>
        ) : null}
      </span>
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
