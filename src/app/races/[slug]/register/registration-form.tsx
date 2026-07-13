"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { formatDzd } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { RaceCategory, RaceEvent } from "@/types/race";
import { registerForRaceAction, type RaceRegistrationActionState } from "./actions";

const initialState: RaceRegistrationActionState = {};

type RegistrationFormProps = {
  race: RaceEvent;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    gender?: string | null;
    dateOfBirth?: Date | null;
    wilaya?: string | null;
    city?: string | null;
  };
  canRegister: boolean;
  existingCategoryIds: string[];
  locale: Locale;
};

export function RegistrationForm({ race, user, canRegister, existingCategoryIds, locale }: RegistrationFormProps) {
  const dict = getDictionary(locale);
  const t = dict.registration;
  const optionalLabel = dict.ui.optional;
  const [state, formAction, pending] = useActionState(registerForRaceAction, initialState);
  const availableCategories = race.categories.filter((category) => !existingCategoryIds.includes(category.id));
  const canSubmit = canRegister && availableCategories.length > 0;

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="raceEventId" value={race.id} />
      <input type="hidden" name="raceSlug" value={race.slug} />
      <input type="hidden" name="lang" value={locale} />

      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        ) : null}
      </div>

      {!canRegister ? (
        <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t.notOpen}
        </p>
      ) : null}

      {canRegister && availableCategories.length === 0 ? (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t.allRegistered}
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">{t.runnerDetails}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.firstName} name="firstName" defaultValue={user.firstName} autoComplete="given-name" />
          <Field label={t.lastName} name="lastName" defaultValue={user.lastName} autoComplete="family-name" />
          <Field label={t.email} name="email" type="email" defaultValue={user.email} autoComplete="email" />
          <Field label={t.phone} name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" />
          <Field label={t.dateOfBirth} name="dateOfBirth" type="date" defaultValue={formatInputDate(user.dateOfBirth)} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t.gender}
            <select
              name="gender"
              defaultValue={user.gender ?? "MALE"}
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              <option value="MALE">{t.genderMale}</option>
              <option value="FEMALE">{t.genderFemale}</option>
              <option value="OTHER">{t.genderOther}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t.wilaya}
            <select
              name="wilaya"
              defaultValue={user.wilaya ?? race.wilaya}
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
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-black text-gray-950">{t.raceSelection}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t.distance}
            <select
              name="raceCategoryId"
              disabled={!canSubmit}
              required
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {availableCategories.map((category) => (
                <CategoryOption key={category.id} category={category} />
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t.tshirtSize}
            <select
              name="tshirtSize"
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              <option value="">{t.noPreference}</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
              <option value="XXXL">3XL</option>
            </select>
          </label>
          <Field label={t.emergencyName} name="emergencyContactName" autoComplete="name" />
          <Field label={t.emergencyPhone} name="emergencyContactPhone" type="tel" autoComplete="tel" />
          <Field label={t.club} name="clubName" required={false} optionalLabel={optionalLabel} />
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <input name="acceptedTerms" type="checkbox" className="mt-1 size-4 rounded border-gray-300 text-brand-teal" required />
        <span>{t.acceptRules}</span>
      </label>

      <Button type="submit" size="lg" disabled={!canSubmit || pending}>
        {pending ? t.saving : t.complete}
      </Button>
    </form>
  );
}

function CategoryOption({ category }: { category: RaceCategory }) {
  return (
    <option value={category.id}>
      {category.name} · {category.distanceKm}K · {formatDzd(category.priceDzd)}
    </option>
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
        {!required && optionalLabel ? <span className="ms-1 font-normal text-gray-500">({optionalLabel})</span> : null}
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
