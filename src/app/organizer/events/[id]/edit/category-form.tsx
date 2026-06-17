"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upsertOrganizerCategoryAction, type OrganizerEditActionState } from "./actions";

const initialState: OrganizerEditActionState = {};

type Category = {
  id?: string;
  name?: string;
  distanceKm?: number;
  priceDzd?: number | null;
  maxParticipants?: number | null;
  startTime?: Date | null;
};

export function CategoryForm({ raceId, category }: { raceId: string; category?: Category }) {
  const [state, formAction, pending] = useActionState(upsertOrganizerCategoryAction, initialState);
  const isNew = !category?.id;

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <input type="hidden" name="raceId" value={raceId} />
      {category?.id ? <input type="hidden" name="categoryId" value={category.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Name" name="name" defaultValue={category?.name ?? ""} placeholder="10K Open" />
        <Field label="Distance KM" name="distanceKm" type="number" step="0.1" defaultValue={category?.distanceKm?.toString() ?? ""} />
        <Field label="Price DZD" name="priceDzd" type="number" defaultValue={category?.priceDzd?.toString() ?? ""} required={false} />
        <Field label="Capacity" name="maxParticipants" type="number" defaultValue={category?.maxParticipants?.toString() ?? ""} required={false} />
        <Field
          label="Start time"
          name="startTime"
          type="datetime-local"
          defaultValue={category?.startTime ? toDateTimeLocal(category.startTime) : ""}
          required={false}
        />
      </div>
      {state.error ? <Message tone="error" message={state.error} /> : null}
      {state.success ? <Message tone="success" message={state.success} /> : null}
      <Button type="submit" variant={isNew ? "secondary" : "outline"} size="sm" disabled={pending} className="justify-self-start">
        {isNew ? <Plus className="size-4" aria-hidden={true} /> : null}
        {pending ? "Saving..." : isNew ? "Add category" : "Save category"}
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
        className="h-10 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function Message({ tone, message }: { tone: "error" | "success"; message: string }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <p className={tone === "error" ? "flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700" : "flex items-start gap-2 rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-700"}>
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
