"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  resendInvitationAction,
  revokeInvitationAction,
  type InviteMemberActionState,
  type ManageMemberActionState
} from "./actions";

const resendInitialState: InviteMemberActionState = {};
const revokeInitialState: ManageMemberActionState = {};

type InvitationControlsProps = {
  invitationId: string;
  canManage: boolean;
};

export function InvitationControls({ invitationId, canManage }: InvitationControlsProps) {
  const [resendState, resendAction, resendPending] = useActionState(resendInvitationAction, resendInitialState);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeInvitationAction, revokeInitialState);
  const error = resendState.error ?? revokeState.error;
  const success = resendState.success ?? revokeState.success;

  if (!canManage) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <form action={resendAction}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <Button type="submit" variant="outline" size="sm" disabled={resendPending || revokePending}>
            <RotateCcw className="size-4" aria-hidden={true} />
            {resendPending ? "Resending..." : "Resend"}
          </Button>
        </form>
        <form action={revokeAction}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={resendPending || revokePending}
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            <XCircle className="size-4" aria-hidden={true} />
            {revokePending ? "Revoking..." : "Revoke"}
          </Button>
        </form>
      </div>
      {error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-start gap-2 rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-700">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
          {success}
        </p>
      ) : null}
      {resendState.warning ? (
        <p className="flex items-start gap-2 rounded-lg bg-orange-50 p-2 text-xs font-semibold text-orange-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden={true} />
          {resendState.warning}
        </p>
      ) : null}
    </div>
  );
}
