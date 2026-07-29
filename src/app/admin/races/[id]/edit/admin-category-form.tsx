"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upsertAdminCategoryAction, type AdminRaceEditActionState } from "./actions";

const initialState: AdminRaceEditActionState = {};

type Category = {
  id?: string;
  name?: string;
  raceType?: string | null;
  distanceKm?: number;
  priceDzd?: number | null;
  maxParticipants?: number | null;
  startTime?: Date | null;
};

export function AdminCategoryForm({ raceId, category }: { raceId: string; category?: Category }) {
  const [state, formAction, pending] = useActionState(upsertAdminCategoryAction, initialState);
  const isNew = !category?.id;

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <input type="hidden" name="raceId" value={raceId} />
      {category?.id ? <input type="hidden" name="categoryId" value={category.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Name" name="name" defaultValue={category?.name ?? ""} placeholder="10K Open" />
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          Race type
          <select name="raceType" defaultValue={category?.raceType ?? "ROAD"} className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100">
            {raceTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <Field label="Distance (km)" name="distanceKm" type="number" step="0.1" defaultValue={category?.distanceKm?.toString() ?? ""} />
        <Field label="Price (DZD)" name="priceDzd" type="number" min="0" defaultValue={category?.priceDzd?.toString() ?? ""} required={false} />
        <Field label="Capacity" name="maxParticipants" type="number" min="1" defaultValue={category?.maxParticipants?.toString() ?? ""} required={false} />
        <Field label="Start time" name="startTime" type="datetime-local" defaultValue={category?.startTime ? toDateTimeLocal(category.startTime) : ""} required={false} />
      </div>
      <div aria-live="polite" className="empty:hidden">
        {state.error ? <Message tone="error" message={state.error} /> : null}
        {state.success ? <Message tone="success" message={state.success} /> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={isNew ? "secondary" : "outline"} size="sm" disabled={pending}>
          {isNew ? <Plus className="size-4" aria-hidden="true" /> : null}
          {pending ? "Saving…" : isNew ? "Add category" : "Save category"}
        </Button>
        {!isNew ? (
          <Button
            type="submit"
            name="intent"
            value="delete"
            formNoValidate
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-red-700 hover:bg-red-50"
            onClick={(event) => { if (!window.confirm("Delete this category? This cannot be undone.")) event.preventDefault(); }}
          >
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const raceTypeOptions = [
  ["ROAD", "Road"], ["TRAIL", "Trail"], ["ULTRA_TRAIL", "Ultra trail"], ["MARATHON", "Marathon"],
  ["HALF_MARATHON", "Half marathon"], ["TEN_K", "10K"], ["FIVE_K", "5K"], ["KIDS", "Kids"],
  ["CHARITY", "Charity"], ["OTHER", "Other"]
].map(([value, label]) => ({ value, label }));

function Field({ label, name, type = "text", required = true, defaultValue = "", placeholder, step, min }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string; step?: string; min?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      <span>{label}{!required ? <span className="ms-1 font-normal text-gray-500">(optional)</span> : null}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} step={step} min={min} className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100" />
    </label>
  );
}

function Message({ tone, message }: { tone: "error" | "success"; message: string }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return <p role={tone === "error" ? "alert" : undefined} className={`flex items-start gap-2 rounded-lg p-2 text-xs font-semibold ${tone === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}><Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{message}</p>;
}

function toDateTimeLocal(value: Date) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
