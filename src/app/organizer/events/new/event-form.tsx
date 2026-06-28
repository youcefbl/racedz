"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CalendarDays, MapPin, Plus, Route, Trash2, Trophy } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { useOrganizerTranslation } from "@/hooks/use-organizer-translation";
import { createOrganizerRaceAction, type OrganizerRaceActionState } from "./actions";

const initialState: OrganizerRaceActionState = {};
const raceTypeOptions = [
  { value: "ROAD", label: "Road race" },
  { value: "TRAIL", label: "Trail" },
  { value: "ULTRA_TRAIL", label: "Ultra trail" },
  { value: "MARATHON", label: "Marathon" },
  { value: "HALF_MARATHON", label: "Half marathon" },
  { value: "TEN_K", label: "10K" },
  { value: "FIVE_K", label: "5K" },
  { value: "KIDS", label: "Kids race" },
  { value: "CHARITY", label: "Charity race" },
  { value: "OTHER", label: "Other" }
];

export function OrganizerEventForm({
  organization,
  defaults
}: {
  organization: { email?: string | null; phone?: string | null; wilaya?: string | null; city?: string | null; commune?: string | null };
  defaults?: { title?: string };
}) {
  const { t } = useOrganizerTranslation();
  const [state, formAction, pending] = useActionState(createOrganizerRaceAction, initialState);
  const [categoryRows, setCategoryRows] = useState(() => [{ id: crypto.randomUUID() }]);

  function addCategory() {
    setCategoryRows((rows) => [...rows, { id: crypto.randomUUID() }]);
  }

  function removeCategory(id: string) {
    setCategoryRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== id)));
  }

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">{t("Race details")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Race name")} name="title" defaultValue={defaults?.title ?? ""} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t("Race type")}
            <select name="raceType" className={controlClassName}>
              {raceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            {t("Description")}
            <textarea
              name="description"
              required
              rows={5}
              className={`${controlClassName} h-auto py-2`}
            />
          </label>
          <Field label={t("Elevation gain")} name="elevationGainText" required={false} optionalLabel={t("optional")} placeholder={t("Example: +850 m across the trail course")} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            {t("Conditions")}
            <textarea
              name="conditions"
              rows={4}
              className={`${controlClassName} h-auto py-2`}
              placeholder={t("Optional terrain, weather, equipment, or participation conditions")}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">{t("Schedule")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Start date and time")} name="startDate" type="datetime-local" />
          <Field label={t("Registration deadline")} name="registrationCloseAt" type="datetime-local" required={false} optionalLabel={t("optional")} />
          <AutoCancelToggle t={t} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">{t("Location")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            {t("Wilaya")}
            <select
              name="wilaya"
              defaultValue={organization.wilaya ?? "Alger"}
              className={controlClassName}
            >
              {ALGERIA_WILAYAS.map((wilaya) => (
                <option key={wilaya} value={wilaya}>
                  {wilaya}
                </option>
              ))}
            </select>
          </label>
          <Field label={t("City")} name="city" defaultValue={organization.city ?? ""} />
          <Field label={t("Commune")} name="commune" defaultValue={organization.commune ?? ""} required={false} optionalLabel={t("optional")} />
          <Field label={t("Address")} name="address" required={false} optionalLabel={t("optional")} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Route className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">{t("Race categories")}</h2>
        </div>
        <div className="grid gap-3">
          {categoryRows.map((row, index) => (
            <div key={row.id} className="grid gap-4 rounded-lg border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-gray-950">{t("Category")} {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeCategory(row.id)}
                  disabled={categoryRows.length === 1}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition hover:border-red-300 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40"
                  aria-label={`${t("Remove category")} ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)]">
                <Field label={t("Category name")} name="categoryName" placeholder={t("10K Open")} />
                <label className="grid gap-2 text-sm font-semibold text-gray-800">
                  {t("Race type")}
                  <select name="categoryRaceType" defaultValue="ROAD" className={controlClassName}>
                    {raceTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.label)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(220px,1.15fr)]">
                <Field label={t("Distance in KM")} name="distanceKm" type="number" step="0.1" />
                <Field label={t("Price DZD")} name="priceDzd" type="number" required={false} optionalLabel={t("optional")} />
                <Field label={t("Capacity")} name="categoryMaxParticipants" type="number" required={false} optionalLabel={t("optional")} />
                <Field label={t("Start time")} name="categoryStartTime" type="datetime-local" required={false} optionalLabel={t("optional")} />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={addCategory}>
            <Plus className="size-4" aria-hidden="true" />
            {t("Add category")}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Total race capacity")} name="maxParticipants" type="number" required={false} optionalLabel={t("optional")} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-gray-950">{t("Contact")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Contact email")} name="contactEmail" type="email" defaultValue={organization.email ?? ""} required={false} optionalLabel={t("optional")} />
          <Field label={t("Contact phone")} name="contactPhone" type="tel" defaultValue={organization.phone ?? ""} required={false} optionalLabel={t("optional")} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-gray-950">{t("Race image")}</h2>
        <ImageUploadField label={t("Main race image")} name="mainImageUrl" scope="race" />
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("Submitting for review...") : t("Create and submit for review")}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  optionalLabel,
  defaultValue = "",
  placeholder,
  step
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  optionalLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  step?: string;
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
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        className={controlClassName}
      />
    </label>
  );
}

const controlClassName =
  "h-11 w-full min-w-0 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100";

function AutoCancelToggle({ defaultChecked = false, t }: { defaultChecked?: boolean; t: (text: string) => string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text)] sm:col-span-2">
      <input
        type="checkbox"
        name="autoCancelUnpaidAfterHours"
        value="48"
        defaultChecked={defaultChecked}
        className="mt-1 size-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
      />
      <span>
        <span className="block font-black text-[var(--text-strong)]">{t("Auto-cancel unpaid registrations")}</span>
        <span className="mt-1 block leading-6">
          {t("Cancel pending registrations automatically if payment is not confirmed within 48 hours.")}
        </span>
      </span>
    </label>
  );
}
