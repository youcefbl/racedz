"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CalendarDays, Image, MapPin, Plus, Route, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { createPlatformRaceAction, type PlatformRaceActionState } from "./actions";

const initialState: PlatformRaceActionState = {};
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

export function PlatformRaceForm() {
  const [state, formAction, pending] = useActionState(createPlatformRaceAction, initialState);
  const [categoryRows, setCategoryRows] = useState(() => [{ id: crypto.randomUUID() }]);

  function addCategory() {
    setCategoryRows((rows) => [...rows, { id: crypto.randomUUID() }]);
  }

  function removeCategory(id: string) {
    setCategoryRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== id)));
  }

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}

      <section className="space-y-3">
        <SectionTitle icon={Trophy} title="Race details" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Race name" name="title" />
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Race type
            <select name="raceType" className={controlClassName}>
              {raceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            Description
            <textarea name="description" required rows={5} className={`${controlClassName} h-auto py-2`} />
          </label>
          <Field label="Elevation gain" name="elevationGainText" required={false} placeholder="Example: +850 m across the trail course" />
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            Conditions
            <textarea
              name="conditions"
              rows={4}
              className={`${controlClassName} h-auto py-2`}
              placeholder="Optional terrain, weather, equipment, or participation conditions"
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 sm:col-span-2">
            <input type="checkbox" name="shirtEnabled" className="size-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal" />
            Offer a race shirt (runners pick a size at registration)
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={CalendarDays} title="Schedule and registration" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date and time" name="startDate" type="datetime-local" />
          <Field label="Registration deadline" name="registrationCloseAt" type="datetime-local" required={false} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Registration state
            <select name="registrationStatus" defaultValue="NOT_OPEN" className={controlClassName}>
              <option value="NOT_OPEN">Not open yet</option>
              <option value="OPEN">Open now</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
          <AutoCancelToggle />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={MapPin} title="Location" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Wilaya
            <select name="wilaya" defaultValue="Alger" className={controlClassName}>
              {ALGERIA_WILAYAS.map((wilaya) => (
                <option key={wilaya} value={wilaya}>
                  {wilaya}
                </option>
              ))}
            </select>
          </label>
          <Field label="City" name="city" />
          <Field label="Commune" name="commune" required={false} />
          <Field label="Address" name="address" required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Route} title="Race categories" />
        <div className="grid gap-3">
          {categoryRows.map((row, index) => (
            <div key={row.id} className="grid gap-4 rounded-lg border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-gray-950">Category {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeCategory(row.id)}
                  disabled={categoryRows.length === 1}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition hover:border-red-300 hover:text-red-700 disabled:pointer-events-none disabled:opacity-40"
                  aria-label={`Remove category ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)]">
                <Field label="Category name" name="categoryName" placeholder="10K Open" />
                <label className="grid gap-2 text-sm font-semibold text-gray-800">
                  Race type
                  <select name="categoryRaceType" defaultValue="ROAD" className={controlClassName}>
                    {raceTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(220px,1.15fr)]">
                <Field label="Distance KM" name="distanceKm" type="number" step="0.1" />
                <Field label="Price DZD" name="priceDzd" type="number" required={false} />
                <Field label="Capacity" name="categoryMaxParticipants" type="number" required={false} />
                <Field label="Start time" name="categoryStartTime" type="datetime-local" required={false} />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={addCategory}>
            <Plus className="size-4" aria-hidden="true" />
            Add category
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total race capacity" name="maxParticipants" type="number" required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={ShieldCheck} title="Organizer contact" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organizer name" name="organizerName" defaultValue="ZidRun Community Desk" />
          <Field label="Organizer URL" name="organizerUrl" type="url" required={false} placeholder="https://zidrun.com" />
          <Field label="Contact email" name="contactEmail" type="email" required={false} />
          <Field label="Contact phone" name="contactPhone" type="tel" required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Image} title="Media" />
        <ImageUploadField label="Main race image" name="mainImageUrl" scope="race" />
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating platform race..." : "Create platform race"}
      </Button>
    </form>
  );
}

const controlClassName =
  "h-11 w-full min-w-0 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100";

function SectionTitle({
  icon: Icon,
  title
}: {
  icon: typeof Trophy;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-5 text-brand-teal" aria-hidden="true" />
      <h2 className="text-lg font-black text-gray-950">{title}</h2>
    </div>
  );
}

function AutoCancelToggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
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
        <span className="block font-black text-[var(--text-strong)]">Auto-cancel unpaid registrations</span>
        <span className="mt-1 block leading-6">
          Cancel pending registrations automatically if payment is not confirmed within 48 hours.
        </span>
      </span>
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue = "",
  placeholder,
  step
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
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
