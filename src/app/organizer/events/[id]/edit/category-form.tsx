"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganizerTranslation } from "@/hooks/use-organizer-translation";
import { upsertOrganizerCategoryAction, type OrganizerEditActionState } from "./actions";

const initialState: OrganizerEditActionState = {};

type Category = {
  id?: string;
  name?: string;
  raceType?: string | null;
  distanceKm?: number;
  priceDzd?: number | null;
  maxParticipants?: number | null;
  startTime?: Date | null;
};

export function CategoryForm({ raceId, category }: { raceId: string; category?: Category }) {
  const { t } = useOrganizerTranslation();
  const [state, formAction, pending] = useActionState(upsertOrganizerCategoryAction, initialState);
  const isNew = !category?.id;

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <input type="hidden" name="raceId" value={raceId} />
      {category?.id ? <input type="hidden" name="categoryId" value={category.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label={t("Name")} name="name" defaultValue={category?.name ?? ""} placeholder={t("10K Open")} />
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          {t("Race type")}
          <select
            name="raceType"
            defaultValue={category?.raceType ?? "ROAD"}
            className="h-10 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
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
        <Field label={t("Distance KM")} name="distanceKm" type="number" step="0.1" defaultValue={category?.distanceKm?.toString() ?? ""} />
        <Field label={t("Price DZD")} name="priceDzd" type="number" defaultValue={category?.priceDzd?.toString() ?? ""} required={false} optionalLabel={t("optional")} />
        <Field label={t("Capacity")} name="maxParticipants" type="number" defaultValue={category?.maxParticipants?.toString() ?? ""} required={false} optionalLabel={t("optional")} />
        <Field
          label={t("Start time")}
          name="startTime"
          type="datetime-local"
          defaultValue={category?.startTime ? toDateTimeLocal(category.startTime) : ""}
          required={false}
          optionalLabel={t("optional")}
        />
      </div>
      <div aria-live="polite" className="empty:hidden">
        {state.error ? <Message tone="error" message={state.error} /> : null}
        {state.success ? <Message tone="success" message={state.success} /> : null}
      </div>
      <Button type="submit" variant={isNew ? "secondary" : "outline"} size="sm" disabled={pending} className="justify-self-start">
        {isNew ? <Plus className="size-4" aria-hidden={true} /> : null}
        {pending ? t("Saving...") : isNew ? t("Add category") : t("Save category")}
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
        className="h-10 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function Message({ tone, message }: { tone: "error" | "success"; message: string }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <p role={tone === "error" ? "alert" : undefined} className={tone === "error" ? "flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700" : "flex items-start gap-2 rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-700"}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
      {message}
    </p>
  );
}

function toDateTimeLocal(value: Date) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
