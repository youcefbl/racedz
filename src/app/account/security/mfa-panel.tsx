"use client";

import { useActionState, useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, KeyRound, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  confirmMfaAction,
  disableMfaAction,
  startMfaEnrollmentAction,
  type MfaActionResult,
  type MfaEnrollment
} from "./actions";

const initial: MfaActionResult = {};

export function MfaPanel({ enabled }: { enabled: boolean }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, startTransition] = useTransition();
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmMfaAction, initial);
  const [disableState, disableAction, disablePending] = useActionState(disableMfaAction, initial);
  const [codesDismissed, setCodesDismissed] = useState(false);

  function beginEnrollment() {
    setStartError(null);
    startTransition(async () => {
      try {
        setEnrollment(await startMfaEnrollmentAction());
      } catch {
        setStartError("Couldn't start enrollment. Please try again.");
      }
    });
  }

  // Show the one-time recovery codes right after a successful confirm, regardless of the (now
  // revalidated) enabled state, until the user acknowledges them.
  if (confirmState.backupCodes?.length && !codesDismissed) {
    return <BackupCodes codes={confirmState.backupCodes} onDone={() => setCodesDismissed(true)} />;
  }

  if (enabled) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 text-green-700">
          <ShieldCheck className="size-5" aria-hidden="true" />
          <h2 className="text-lg font-bold">Two-factor authentication is on</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          You&apos;ll be asked for a code from your authenticator app each time you sign in. Keep your recovery codes
          somewhere safe — each one works once if you lose your device.
        </p>
        <form action={disableAction} className="mt-4 grid gap-3 sm:max-w-sm">
          <label className="grid gap-1.5 text-sm font-semibold text-gray-800">
            Turn off two-factor
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Authenticator or recovery code"
              required
              className="h-11 rounded-lg border border-gray-300 px-3 font-normal tracking-widest outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
          </label>
          {disableState.error ? (
            <p role="alert" className="text-sm font-semibold text-red-700">{disableState.error}</p>
          ) : null}
          <div>
            <Button type="submit" variant="outline" disabled={disablePending} className="text-red-700">
              <ShieldOff className="size-4" aria-hidden="true" /> {disablePending ? "Disabling…" : "Disable"}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  if (enrollment) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-950">Set up your authenticator</h2>
        <ol className="mt-3 grid gap-3 text-sm text-gray-700">
          <li>
            <span className="font-semibold">1.</span> Scan this QR code with your authenticator app (Google
            Authenticator, Authy, 1Password…):
            {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, not an optimizable asset */}
            <img
              src={enrollment.qrDataUrl}
              alt="Two-factor setup QR code"
              width={220}
              height={220}
              className="mt-2 rounded-lg border border-gray-200 bg-white p-2"
            />
            <span className="mt-2 block text-xs text-gray-500">
              Can&apos;t scan? Enter this setup key manually instead:
            </span>
            <CopyField className="mt-1" value={formatSecret(enrollment.secret)} copyValue={enrollment.secret} />
            <span className="mt-1 block text-xs text-gray-500">
              Or paste this setup link if your app supports it:
            </span>
            <CopyField className="mt-1" value={enrollment.otpauthUrl} copyValue={enrollment.otpauthUrl} mono />
          </li>
          <li>
            <span className="font-semibold">2.</span> Enter the 6-digit code the app shows to confirm:
          </li>
        </ol>
        <form action={confirmAction} className="mt-3 grid gap-3 sm:max-w-sm">
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            required
            className="h-11 rounded-lg border border-gray-300 px-3 font-normal tracking-widest outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
          {confirmState.error ? (
            <p role="alert" className="text-sm font-semibold text-red-700">{confirmState.error}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={confirmPending}>
              {confirmPending ? "Verifying…" : "Verify & enable"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEnrollment(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2 text-gray-900">
        <ShieldOff className="size-5 text-gray-400" aria-hidden="true" />
        <h2 className="text-lg font-bold">Two-factor authentication is off</h2>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        Add a second step at sign-in with an authenticator app. Strongly recommended for admin accounts.
      </p>
      {disableState.success ? (
        <p className="mt-2 text-sm font-semibold text-green-700">{disableState.success}</p>
      ) : null}
      {startError ? <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{startError}</p> : null}
      <Button type="button" onClick={beginEnrollment} disabled={isStarting} className="mt-4">
        <ShieldCheck className="size-4" aria-hidden="true" /> {isStarting ? "Preparing…" : "Enable two-factor"}
      </Button>
    </section>
  );
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-center gap-2 text-amber-800">
        <KeyRound className="size-5" aria-hidden="true" />
        <h2 className="text-lg font-bold">Save your recovery codes</h2>
      </div>
      <p className="mt-2 text-sm text-amber-900">
        Store these somewhere safe. Each code works once to sign in if you lose your authenticator. They won&apos;t be
        shown again.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-gray-900">
        {codes.map((code) => (
          <li key={code} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-center tracking-wider">
            {code}
          </li>
        ))}
      </ul>
      <Button type="button" onClick={onDone} className="mt-4">
        <Check className="size-4" aria-hidden="true" /> I&apos;ve saved them
      </Button>
    </section>
  );
}

function CopyField({
  value,
  copyValue,
  className,
  mono
}: {
  value: string;
  copyValue: string;
  className?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={`flex items-stretch gap-2 ${className ?? ""}`}>
      <code
        className={`min-w-0 flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 ${mono ? "font-mono text-xs" : "tracking-wider"}`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(copyValue).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        aria-label="Copy"
        className="inline-flex size-10 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        {copied ? <Check className="size-4 text-green-600" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </button>
    </span>
  );
}

function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
