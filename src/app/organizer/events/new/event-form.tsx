"use client";

import { useActionState } from "react";
import { AlertCircle, CalendarDays, MapPin, Route, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { createOrganizerRaceAction, type OrganizerRaceActionState } from "./actions";

const initialState: OrganizerRaceActionState = {};

export function OrganizerEventForm({
  organization,
  defaults
}: {
  organization: { email?: string | null; phone?: string | null; wilaya?: string | null; city?: string | null; commune?: string | null };
  defaults?: { title?: string };
}) {
  const [state, formAction, pending] = useActionState(createOrganizerRaceAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Race details</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Race name" name="title" defaultValue={defaults?.title ?? ""} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Race type
            <select name="raceType" className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100">
              <option value="ROAD">Road race</option>
              <option value="TRAIL">Trail</option>
              <option value="ULTRA_TRAIL">Ultra trail</option>
              <option value="MARATHON">Marathon</option>
              <option value="HALF_MARATHON">Half marathon</option>
              <option value="TEN_K">10K</option>
              <option value="FIVE_K">5K</option>
              <option value="KIDS">Kids race</option>
              <option value="CHARITY">Charity race</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            Description
            <textarea
              name="description"
              required
              minLength={20}
              rows={5}
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Schedule</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date and time" name="startDate" type="datetime-local" />
          <Field label="Registration deadline" name="registrationCloseAt" type="datetime-local" required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Location</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Wilaya
            <select
              name="wilaya"
              defaultValue={organization.wilaya ?? "Alger"}
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              {ALGERIA_WILAYAS.map((wilaya) => (
                <option key={wilaya} value={wilaya}>
                  {wilaya}
                </option>
              ))}
            </select>
          </label>
          <Field label="City" name="city" defaultValue={organization.city ?? ""} />
          <Field label="Commune" name="commune" defaultValue={organization.commune ?? ""} required={false} />
          <Field label="Address" name="address" required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Route className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">First category</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category name" name="categoryName" placeholder="10K Open" />
          <Field label="Distance in KM" name="distanceKm" type="number" step="0.1" />
          <Field label="Price DZD" name="priceDzd" type="number" required={false} />
          <Field label="Category capacity" name="categoryMaxParticipants" type="number" required={false} />
          <Field label="Total race capacity" name="maxParticipants" type="number" required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-gray-950">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email" name="contactEmail" type="email" defaultValue={organization.email ?? ""} required={false} />
          <Field label="Contact phone" name="contactPhone" type="tel" defaultValue={organization.phone ?? ""} required={false} />
        </div>
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Submitting for review..." : "Create and submit for review"}
      </Button>
    </form>
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
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
