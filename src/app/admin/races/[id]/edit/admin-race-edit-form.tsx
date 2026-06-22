"use client";

import { useActionState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, ImageIcon, MapPin, ShieldCheck, Trophy } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import type { AdminRaceForEdit } from "@/lib/admin";
import { updateAdminRaceAction, type AdminRaceEditActionState } from "./actions";

const initialState: AdminRaceEditActionState = {};

export function AdminRaceEditForm({ race }: { race: AdminRaceForEdit }) {
  const [state, formAction, pending] = useActionState(updateAdminRaceAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="raceId" value={race.id} />
      {state.error ? <Message tone="error" message={state.error} /> : null}
      {state.success ? <Message tone="success" message={state.success} /> : null}

      <section className="space-y-3">
        <SectionTitle icon={Trophy} title="Race details" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Race name" name="title" defaultValue={race.title} />
          <Select label="Race type" name="raceType" defaultValue={race.raceType} options={raceTypeOptions} />
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
          <Field label="Elevation gain" name="elevationGainText" defaultValue={race.elevationGainText ?? ""} required={false} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            Conditions
            <textarea
              name="conditions"
              rows={4}
              defaultValue={race.conditions ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={ShieldCheck} title="Admin controls" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Publication status" name="status" defaultValue={race.status} options={statusOptions} />
          <Select label="Registration status" name="registrationStatus" defaultValue={race.registrationStatus} options={registrationStatusOptions} />
          <AutoCancelToggle defaultChecked={race.autoCancelUnpaidAfterHours === 48} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={CalendarDays} title="Schedule" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date and time" name="startDate" type="datetime-local" defaultValue={toDateTimeLocal(race.startDate)} />
          <Field
            label="Registration deadline"
            name="registrationCloseAt"
            type="datetime-local"
            defaultValue={race.registrationCloseAt ? toDateTimeLocal(race.registrationCloseAt) : ""}
            required={false}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={MapPin} title="Location and contact" />
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Organizer name" name="organizerName" defaultValue={race.organizerName ?? ""} required={false} />
          <Field label="Organizer URL" name="organizerUrl" type="url" defaultValue={race.organizerUrl ?? ""} required={false} />
          <Field label="Contact email" name="contactEmail" type="email" defaultValue={race.contactEmail ?? ""} required={false} />
          <Field label="Contact phone" name="contactPhone" type="tel" defaultValue={race.contactPhone ?? ""} required={false} />
          <Field label="Total race capacity" name="maxParticipants" type="number" defaultValue={race.maxParticipants?.toString() ?? ""} required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={ImageIcon} title="Media" />
        <ImageUploadField label="Main race image" name="mainImageUrl" scope="race" defaultValue={race.mainImageUrl} />
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving race..." : "Save admin edits"}
      </Button>
    </form>
  );
}

const raceTypeOptions = [
  { value: "ROAD", label: "Road" },
  { value: "TRAIL", label: "Trail" },
  { value: "ULTRA_TRAIL", label: "Ultra trail" },
  { value: "MARATHON", label: "Marathon" },
  { value: "HALF_MARATHON", label: "Half marathon" },
  { value: "TEN_K", label: "10K" },
  { value: "FIVE_K", label: "5K" },
  { value: "KIDS", label: "Kids" },
  { value: "CHARITY", label: "Charity" },
  { value: "OTHER", label: "Other" }
];

const statusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" }
];

const registrationStatusOptions = [
  { value: "NOT_OPEN", label: "Not open" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "FULL", label: "Full" },
  { value: "CANCELLED", label: "Cancelled" }
];

function SectionTitle({ icon: Icon, title }: { icon: typeof Trophy; title: string }) {
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

function Select({
  label,
  name,
  defaultValue,
  options
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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

function Message({ tone, message }: { tone: "error" | "success"; message: string }) {
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
