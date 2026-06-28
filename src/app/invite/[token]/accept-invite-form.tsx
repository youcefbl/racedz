"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { acceptInviteAction, type AcceptInviteActionState } from "./actions";

const initialState: AcceptInviteActionState = {};

export function AcceptInviteForm({ token, disabled, locale }: { token: string; disabled: boolean; locale: Locale }) {
  const t = getDictionary(locale).invite;
  const [state, formAction, pending] = useActionState(acceptInviteAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden={true} />
            {state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={disabled || pending}>
        <CheckCircle2 className="size-5" aria-hidden={true} />
        {pending ? t.accepting : t.acceptInvitation}
      </Button>
    </form>
  );
}
