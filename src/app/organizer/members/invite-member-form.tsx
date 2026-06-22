"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganizerTranslation } from "@/hooks/use-organizer-translation";
import { inviteMemberAction, type InviteMemberActionState } from "./actions";

const initialState: InviteMemberActionState = {};

export function InviteMemberForm({ canInvite }: { canInvite: boolean }) {
  const { t } = useOrganizerTranslation();
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <MailPlus className="size-5 text-brand-teal" aria-hidden="true" />
        <h2 className="text-lg font-black text-gray-950">{t("Invite organization user")}</h2>
      </div>
      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.success}
        </p>
      ) : null}
      {state.warning ? (
        <p className="flex items-start gap-2 rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.warning}
        </p>
      ) : null}
      <div className="grid gap-3">
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          {t("Email")}
          <input
            name="email"
            type="email"
            required
            disabled={!canInvite}
            placeholder="teammate@example.com"
            className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          {t("Role")}
          <select
            name="role"
            disabled={!canInvite}
            className="h-11 rounded-lg border border-gray-300 px-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="MEMBER">{t("Member")}</option>
            <option value="ADMIN">{t("Admin")}</option>
          </select>
        </label>
        <Button type="submit" disabled={!canInvite || pending}>
          {pending ? t("Inviting...") : t("Invite")}
        </Button>
      </div>
      {!canInvite ? <p className="text-sm text-gray-500">{t("Only organization owners and admins can invite users.")}</p> : null}
    </form>
  );
}
