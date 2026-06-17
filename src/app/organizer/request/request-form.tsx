"use client";

import { useActionState } from "react";
import { AlertCircle, Building2, ImageIcon, LinkIcon, MapPin } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { ALGERIA_WILAYAS } from "@/lib/algeria";
import { requestOrganizationAction, type OrganizationRequestActionState } from "./actions";

const initialState: OrganizationRequestActionState = {};

type OrganizationRequestFormProps = {
  user: {
    email: string;
    phone?: string | null;
    wilaya?: string | null;
    city?: string | null;
    commune?: string | null;
  };
};

export function OrganizationRequestForm({ user }: OrganizationRequestFormProps) {
  const [state, formAction, pending] = useActionState(requestOrganizationAction, initialState);

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
          <Building2 className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Organization details</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organization name" name="name" autoComplete="organization" />
          <Field label="Contact email" name="email" type="email" defaultValue={user.email} autoComplete="email" />
          <Field label="Contact phone" name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" />
          <label className="grid gap-2 text-sm font-semibold text-gray-800 sm:col-span-2">
            Description
            <textarea
              name="description"
              required
              minLength={20}
              rows={5}
              placeholder="Tell RaceDZ what kind of races your organization runs and where you operate."
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Location</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Wilaya
            <select
              name="wilaya"
              required
              defaultValue={user.wilaya ?? "Alger"}
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              {ALGERIA_WILAYAS.map((wilaya) => (
                <option key={wilaya} value={wilaya}>
                  {wilaya}
                </option>
              ))}
            </select>
          </label>
          <Field label="City" name="city" defaultValue={user.city ?? ""} />
          <Field label="Commune" name="commune" defaultValue={user.commune ?? ""} required={false} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Organization logo</h2>
        </div>
        <ImageUploadField label="Logo image" name="logoUrl" scope="organization" />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Public links</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Website" name="website" type="url" required={false} placeholder="https://example.com" />
          <Field label="Facebook" name="facebookUrl" type="url" required={false} placeholder="https://facebook.com/..." />
          <Field label="Instagram" name="instagramUrl" type="url" required={false} placeholder="https://instagram.com/..." />
        </div>
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Submitting request..." : "Request organizer access"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
  autoComplete,
  defaultValue = "",
  placeholder
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
