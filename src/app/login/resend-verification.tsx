"use client";

import { useEffect, useState } from "react";
import { resendVerificationAction } from "./actions";

const COOLDOWN_SECONDS = 120;

type ResendLabels = {
  prompt: string;
  resend: string;
  sending: string;
  sent: string;
  /** Uses {s} for the remaining seconds. */
  retryIn: string;
};

/**
 * "Didn't get the email?" resend control with a 120s cooldown. The email was just sent
 * at registration, so we start the countdown immediately and persist the next-allowed
 * time in localStorage so a page reload doesn't reset it.
 */
export function ResendVerification({ email, labels, lang }: { email: string; labels: ResendLabels; lang?: string }) {
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const storageKey = `verify-resend:${email.toLowerCase()}`;

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(storageKey) ?? 0);
    const now = Date.now();
    if (stored > now) {
      setSecondsLeft(Math.ceil((stored - now) / 1000));
    } else {
      window.localStorage.setItem(storageKey, String(now + COOLDOWN_SECONDS * 1000));
      setSecondsLeft(COOLDOWN_SECONDS);
    }
  }, [storageKey]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  async function resend() {
    if (secondsLeft > 0 || status === "sending") return;
    setStatus("sending");
    await resendVerificationAction(email, lang);
    window.localStorage.setItem(storageKey, String(Date.now() + COOLDOWN_SECONDS * 1000));
    setSecondsLeft(COOLDOWN_SECONDS);
    setStatus("sent");
  }

  const disabled = secondsLeft > 0 || status === "sending";

  return (
    <p className="mt-2 text-sm text-gray-600">
      {labels.prompt}{" "}
      <button
        type="button"
        onClick={resend}
        disabled={disabled}
        className="font-bold text-brand-teal underline underline-offset-2 disabled:text-gray-400 disabled:no-underline"
      >
        {status === "sending"
          ? labels.sending
          : secondsLeft > 0
            ? labels.retryIn.replace("{s}", String(secondsLeft))
            : labels.resend}
      </button>
      {status === "sent" && secondsLeft > 0 ? <span className="ms-2 font-semibold text-green-700">{labels.sent}</span> : null}
    </p>
  );
}
