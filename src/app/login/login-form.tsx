"use client";

import { Mail, LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = {};

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/account"} />
      {state.error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>
      ) : null}
      <label className="grid gap-2 text-sm font-semibold text-gray-800">
        Email
        <span className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="runner@example.com"
            required
            className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </span>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-gray-800">
        Password
        <span className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="racedz-demo-password"
            required
            minLength={8}
            className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 font-normal outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </span>
      </label>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in..." : "Login"}
      </Button>
    </form>
  );
}
