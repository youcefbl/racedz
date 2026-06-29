"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { useOrganizerTranslation } from "@/hooks/use-organizer-translation";
import {
  removeMemberAction,
  updateMemberRoleAction,
  type ManageMemberActionState
} from "./actions";

const initialState: ManageMemberActionState = {};

type MemberControlsProps = {
  memberId: string;
  currentRole: "OWNER" | "ADMIN" | "MEMBER";
  canManage: boolean;
  canAssignOwner: boolean;
};

export function MemberControls({ memberId, currentRole, canManage, canAssignOwner }: MemberControlsProps) {
  const { t } = useOrganizerTranslation();
  const [roleState, roleAction, rolePending] = useActionState(updateMemberRoleAction, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeMemberAction, initialState);
  const message = roleState.error ?? roleState.success ?? removeState.error ?? removeState.success;
  const messageTone = roleState.error || removeState.error ? "error" : "success";

  return (
    <div className="grid gap-2">
      <form action={roleAction} className="grid gap-2 sm:grid-cols-[160px_auto] lg:grid-cols-[160px_auto]">
        <input type="hidden" name="memberId" value={memberId} />
        <label>
          <span className="sr-only">{t("Role")}</span>
          <select
            name="role"
            defaultValue={currentRole}
            disabled={!canManage || rolePending}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {canAssignOwner || currentRole === "OWNER" ? <option value="OWNER">{t("Owner")}</option> : null}
            <option value="ADMIN">{t("Admin")}</option>
            <option value="MEMBER">{t("Member")}</option>
          </select>
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={!canManage || rolePending}>
          {rolePending ? t("Saving...") : t("Save")}
        </Button>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="memberId" value={memberId} />
        <ConfirmSubmit
          variant="ghost"
          size="sm"
          disabled={!canManage || removePending}
          className="w-full justify-start text-red-700 hover:bg-red-50"
          title={t("Remove this member?")}
          description={t("They lose access to this organization immediately. This cannot be undone.")}
          confirmLabel={t("Remove member")}
          cancelLabel={t("Keep member")}
        >
          <Trash2 className="size-4" aria-hidden={true} />
          {removePending ? t("Removing...") : t("Remove member")}
        </ConfirmSubmit>
      </form>
      {message ? (
        <p
          className={
            messageTone === "error"
              ? "flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700"
              : "flex items-start gap-2 rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-700"
          }
        >
          {messageTone === "error" ? (
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
          ) : (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
          )}
          {message}
        </p>
      ) : null}
    </div>
  );
}
