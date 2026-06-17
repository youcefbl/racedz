"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInviteAction, type AcceptInviteActionState } from "./actions";

const initialState: AcceptInviteActionState = {};

export function AcceptInviteForm({ token, disabled }: { token: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden={true} />
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={disabled || pending}>
        <CheckCircle2 className="size-5" aria-hidden={true} />
        {pending ? "Accepting..." : "Accept invitation"}
      </Button>
    </form>
  );
}
