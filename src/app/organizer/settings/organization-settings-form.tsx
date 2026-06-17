"use client";

import { useActionState } from "react";
import { AlertCircle, Building2, CheckCircle2, ImageIcon, LinkIcon, MapPin } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import type { OrganizationProfile } from "@/lib/organizer";
import { updateOrganizationSettingsAction, type OrganizationSettingsActionState } from "./actions";

const initialState: OrganizationSettingsActionState = {};

export function OrganizationSettingsForm({
  organization,
  canEdit
}: {
  organization: OrganizationProfile;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettingsAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {state.error ? <Message tone="error" message={state.error} /> : null}
      {state.success ? <Message tone="success" message={state.success} /> : null}
      {!canEdit ? <p className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700">Only organization owners and admins can edit settings.</p> : null}

      <section className="space-y-3">
        <SectionTitle icon={Building2} title="Organization details" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organization name" name="name" defaultValue={organization.name} disabled={!canEdit} />
          <Field label="Contact email" name="email" type="email" defaultValue={organization.email ?? ""} disabled={!canEdit} />
          <Field label="Contact phone" name="phone" type="tel" defaultValue={organization.phone ?? ""} disabled={!canEdit} />
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            Description
            <textarea
              name="description"
              required
              minLength={20}
              rows={5}
              defaultValue={organization.description ?? ""}
              disabled={!canEdit}
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={ImageIcon} title="Logo" />
        {canEdit ? (
          <ImageUploadField label="Organization logo" name="logoUrl" scope="organization" defaultValue={organization.logoUrl} />
        ) : (
          <input type="hidden" name="logoUrl" value={organization.logoUrl ?? ""} readOnly />
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle icon={MapPin} title="Location" />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Wilaya
            <select
              name="wilaya"
              required
              defaultValue={organization.wilaya ?? "Alger"}
              disabled={!canEdit}
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:bg-gray-50 disabled:text-gray-500"
            >
              {ALGERIA_WILAYAS.map((wilaya) => (
                <option key={wilaya} value={wilaya}>
                  {wilaya}
                </option>
              ))}
            </select>
          </label>
          <Field label="City" name="city" defaultValue={organization.city ?? ""} disabled={!canEdit} />
          <Field label="Commune" name="commune" defaultValue={organization.commune ?? ""} required={false} disabled={!canEdit} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={LinkIcon} title="Public links" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Website" name="website" type="url" defaultValue={organization.website ?? ""} required={false} disabled={!canEdit} />
          <Field label="Facebook" name="facebookUrl" type="url" defaultValue={organization.facebookUrl ?? ""} required={false} disabled={!canEdit} />
          <Field label="Instagram" name="instagramUrl" type="url" defaultValue={organization.instagramUrl ?? ""} required={false} disabled={!canEdit} />
        </div>
      </section>

      <Button type="submit" size="lg" disabled={pending || !canEdit}>
        {pending ? "Saving..." : "Save organization settings"}
      </Button>
    </form>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Building2; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-5 text-brand-teal" aria-hidden="true" />
      <h2 className="text-lg font-black text-gray-950">{title}</h2>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue = "",
  disabled = false
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        disabled={disabled}
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:bg-gray-50 disabled:text-gray-500"
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
