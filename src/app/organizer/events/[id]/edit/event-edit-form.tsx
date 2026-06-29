"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { useOrganizerTranslation } from "@/hooks/use-organizer-translation";
import { updateOrganizerRaceAction, type OrganizerEditActionState } from "./actions";

const initialState: OrganizerEditActionState = {};

type EditableRace = {
  id: string;
  title: string;
  description: string;
  elevationGainText: string | null;
  conditions: string | null;
  raceType: string;
  startDate: Date;
  registrationCloseAt: Date | null;
  wilaya: string;
  city: string;
  commune: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  baridiMobNumber: string | null;
  ccpAccount: string | null;
  ccpKey: string | null;
  paymentNote: string | null;
  maxParticipants: number | null;
  mainImageUrl: string | null;
  autoCancelUnpaidAfterHours: number | null;
};

export function EventEditForm({ race }: { race: EditableRace }) {
  const { t } = useOrganizerTranslation();
  const [state, formAction, pending] = useActionState(updateOrganizerRaceAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="raceId" value={race.id} />
      <div>
        <h2 className="text-xl font-black text-gray-950">{t("Race details")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("Changes remain hidden from the public site until admin publication.")}</p>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {state.error ? <FormMessage tone="error" message={state.error} /> : null}
        {state.success ? <FormMessage tone="success" message={state.success} /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Race name")} name="title" defaultValue={race.title} />
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          {t("Race type")}
          <select
            name="raceType"
            defaultValue={race.raceType}
            className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          >
            <option value="ROAD">{t("Road race")}</option>
            <option value="TRAIL">{t("Trail")}</option>
            <option value="ULTRA_TRAIL">{t("Ultra trail")}</option>
            <option value="MARATHON">{t("Marathon")}</option>
            <option value="HALF_MARATHON">{t("Half marathon")}</option>
            <option value="TEN_K">10K</option>
            <option value="FIVE_K">5K</option>
            <option value="KIDS">{t("Kids race")}</option>
            <option value="CHARITY">{t("Charity race")}</option>
            <option value="OTHER">{t("Other")}</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
          {t("Description")}
          <textarea
            name="description"
            required
            rows={5}
            defaultValue={race.description}
            className="rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <Field label={t("Elevation gain")} name="elevationGainText" defaultValue={race.elevationGainText ?? ""} required={false} optionalLabel={t("optional")} />
        <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
          {t("Conditions")}
          <textarea
            name="conditions"
            rows={4}
            defaultValue={race.conditions ?? ""}
            className="rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <Field label={t("Start date and time")} name="startDate" type="datetime-local" defaultValue={toDateTimeLocal(race.startDate)} />
        <Field
          label={t("Registration deadline")}
          name="registrationCloseAt"
          type="datetime-local"
          defaultValue={race.registrationCloseAt ? toDateTimeLocal(race.registrationCloseAt) : ""}
          required={false}
          optionalLabel={t("optional")}
        />
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          {t("Wilaya")}
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
        <Field label={t("City")} name="city" defaultValue={race.city} />
        <Field label={t("Commune")} name="commune" defaultValue={race.commune ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("Address")} name="address" defaultValue={race.address ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("Contact email")} name="contactEmail" type="email" defaultValue={race.contactEmail ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("Contact phone")} name="contactPhone" type="tel" defaultValue={race.contactPhone ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("BaridiMob number")} name="baridiMobNumber" defaultValue={race.baridiMobNumber ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("CCP account")} name="ccpAccount" defaultValue={race.ccpAccount ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("CCP key")} name="ccpKey" defaultValue={race.ccpKey ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("Payment note (how runners should pay)")} name="paymentNote" defaultValue={race.paymentNote ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("Total race capacity")} name="maxParticipants" type="number" defaultValue={race.maxParticipants?.toString() ?? ""} required={false} optionalLabel={t("optional")} />
        <AutoCancelToggle defaultChecked={race.autoCancelUnpaidAfterHours === 48} t={t} />
        <div className="sm:col-span-2">
          <ImageUploadField label={t("Main race image")} name="mainImageUrl" scope="race" defaultValue={race.mainImageUrl} />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("Saving...") : t("Save race details")}
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
  defaultValue = ""
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  optionalLabel?: string;
  defaultValue?: string;
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
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

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

function FormMessage({ tone, message }: { tone: "error" | "success"; message: string }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <p role={tone === "error" ? "alert" : undefined} className={tone === "error" ? "flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700" : "flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700"}>
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
