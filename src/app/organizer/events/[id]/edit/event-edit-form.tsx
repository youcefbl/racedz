"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { updateOrganizerRaceAction, type OrganizerEditActionState } from "./actions";

const initialState: OrganizerEditActionState = {};

type EditableRace = {
  id: string;
  title: string;
  description: string;
  raceType: string;
  startDate: Date;
  registrationCloseAt: Date | null;
  wilaya: string;
  city: string;
  commune: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  maxParticipants: number | null;
  mainImageUrl: string | null;
};

export function EventEditForm({ race }: { race: EditableRace }) {
  const [state, formAction, pending] = useActionState(updateOrganizerRaceAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="raceId" value={race.id} />
      <div>
        <h2 className="text-xl font-black text-gray-950">Race details</h2>
        <p className="mt-1 text-sm text-gray-500">Changes remain hidden from the public site until admin publication.</p>
      </div>
      {state.error ? <FormMessage tone="error" message={state.error} /> : null}
      {state.success ? <FormMessage tone="success" message={state.success} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Race name" name="title" defaultValue={race.title} />
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          Race type
          <select
            name="raceType"
            defaultValue={race.raceType}
            className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
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
            rows={5}
            defaultValue={race.description}
            className="rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <Field label="Start date and time" name="startDate" type="datetime-local" defaultValue={toDateTimeLocal(race.startDate)} />
        <Field
          label="Registration deadline"
          name="registrationCloseAt"
          type="datetime-local"
          defaultValue={race.registrationCloseAt ? toDateTimeLocal(race.registrationCloseAt) : ""}
          required={false}
        />
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          Wilaya
          <select
            name="wilaya"
            defaultValue={race.wilaya}
            className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            {ALGERIA_WILAYAS.map((wilaya) => (
              <option key={wilaya} value={wilaya}>
                {wilaya}
              </option>
            ))}
          </select>
        </label>
        <Field label="City" name="city" defaultValue={race.city} />
        <Field label="Commune" name="commune" defaultValue={race.commune ?? ""} required={false} />
        <Field label="Address" name="address" defaultValue={race.address ?? ""} required={false} />
        <Field label="Contact email" name="contactEmail" type="email" defaultValue={race.contactEmail ?? ""} required={false} />
        <Field label="Contact phone" name="contactPhone" type="tel" defaultValue={race.contactPhone ?? ""} required={false} />
        <Field label="Total race capacity" name="maxParticipants" type="number" defaultValue={race.maxParticipants?.toString() ?? ""} required={false} />
        <div className="sm:col-span-2">
          <ImageUploadField label="Main race image" name="mainImageUrl" scope="race" defaultValue={race.mainImageUrl} />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving..." : "Save race details"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue = ""
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function FormMessage({ tone, message }: { tone: "error" | "success"; message: string }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <p className={tone === "error" ? "flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700" : "flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700"}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden={true} />
      {message}
    </p>
  );
}

function toDateTimeLocal(value: Date) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
