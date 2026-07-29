"use client";

import { useActionState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, ExternalLink, ImageIcon, MapPin, ShieldCheck, Sparkles, Trophy, WalletCards } from "lucide-react";
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

      {race.importSource ? <ImportReviewPanel race={race} /> : null}

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
          <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 sm:col-span-2">
            <input type="checkbox" name="shirtEnabled" defaultChecked={race.shirtEnabled} className="size-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal" />
            Offer a race shirt (runners pick a size at registration)
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={WalletCards} title="Manual payment details" />
        <p className="text-sm leading-6 text-gray-600">Check imported account numbers character by character against the original post.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="BaridiMob number" name="baridiMobNumber" defaultValue={race.baridiMobNumber ?? ""} required={false} />
          <Field label="CCP account" name="ccpAccount" defaultValue={race.ccpAccount ?? ""} required={false} />
          <Field label="CCP key" name="ccpKey" defaultValue={race.ccpKey ?? ""} required={false} />
          <Field label="Payment note" name="paymentNote" defaultValue={race.paymentNote ?? ""} required={false} />
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

function ImportReviewPanel({ race }: { race: AdminRaceForEdit }) {
  const summary = readImportSummary(race.importExtractionJson);
  const reviewed = Boolean(race.importReviewedAt);

  return (
    <section className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-5 text-brand-orange" aria-hidden="true" />
        <h2 className="font-black text-gray-950">AI import review</h2>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${reviewed ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>
          {reviewed ? "Human verified" : "Verification required"}
        </span>
        {summary.confidence ? <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-700">AI confidence: {summary.confidence}</span> : null}
      </div>
      {race.importSourceUrl ? (
        <a href={race.importSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-teal underline underline-offset-2">
          Open original post <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      ) : null}
      {summary.imageUrls.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Imported post images">
          {summary.imageUrls.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block size-20 shrink-0 overflow-hidden rounded-lg border border-orange-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Imported post image ${index + 1}`} className="size-full object-contain" />
            </a>
          ))}
        </div>
      ) : null}
      {summary.warnings.length > 0 ? (
        <div>
          <p className="text-sm font-black text-gray-950">Must verify</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm leading-6 text-gray-700">
            {summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
      {summary.notes ? <p className="text-sm leading-6 text-gray-700"><strong>AI notes:</strong> {summary.notes}</p> : null}
      {!reviewed ? (
        <label className="flex items-start gap-3 rounded-lg border border-orange-200 bg-white p-3 text-sm leading-6 text-gray-800">
          <input type="checkbox" name="confirmImportReview" className="mt-1 size-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal" />
          <span>
            <strong className="block text-gray-950">I verified this import against the original post</strong>
            Confirm the name, date/time, wilaya/city, every distance and price, organizer/contact details, and registration deadline. This confirmation is required before publishing.
          </span>
        </label>
      ) : null}
    </section>
  );
}

function readImportSummary(value: unknown): { confidence?: string; notes?: string; warnings: string[]; imageUrls: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { warnings: [], imageUrls: [] };
  const root = value as Record<string, unknown>;
  const race = root.race && typeof root.race === "object" && !Array.isArray(root.race) ? root.race as Record<string, unknown> : {};
  const warnings = Array.isArray(root.reviewWarnings)
    ? root.reviewWarnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return {
    confidence: typeof race.confidence === "string" ? race.confidence : undefined,
    notes: typeof race.notes === "string" && race.notes.trim() ? race.notes : undefined,
    warnings,
    imageUrls: Array.isArray(root.imageUrls)
      ? root.imageUrls.filter((item): item is string => typeof item === "string" && /^\/uploads\/race\//.test(item))
      : []
  };
}

function toDateTimeLocal(value: Date) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
