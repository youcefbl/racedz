"use client";

import { useActionState } from "react";
import { AlertCircle, LogIn, UserPlus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { CoachLocale } from "@/components/coach/types";
import { withLocale } from "@/lib/i18n";
import { joinGroupAction, type JoinGroupActionState } from "./actions";

const copy = {
  en: { join: "Join group", joining: "Joining…", signInFirst: "Sign in to join", createAccount: "Create an account" },
  fr: { join: "Rejoindre le groupe", joining: "Adhésion…", signInFirst: "Connectez-vous pour rejoindre", createAccount: "Créer un compte" },
  ar: { join: "الانضمام إلى المجموعة", joining: "جارٍ الانضمام…", signInFirst: "سجّل الدخول للانضمام", createAccount: "إنشاء حساب" }
} as const;

const initialState: JoinGroupActionState = {};

export function JoinGroupForm({ token, loggedIn, locale }: { token: string; loggedIn: boolean; locale: CoachLocale }) {
  const t = copy[locale];
  const [state, formAction, pending] = useActionState(joinGroupAction, initialState);

  if (!loggedIn) {
    return (
      <div className="grid gap-3">
        <ButtonLink href={withLocale(`/login?callbackUrl=/groups/join/${token}`, locale)} size="lg">
          <LogIn className="size-5" aria-hidden="true" />
          {t.signInFirst}
        </ButtonLink>
        <ButtonLink href={withLocale(`/register?callbackUrl=/groups/join/${token}`, locale)} variant="outline" size="lg">
          <UserPlus className="size-5" aria-hidden="true" />
          {t.createAccount}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t.joining : t.join}
      </Button>
    </form>
  );
}
