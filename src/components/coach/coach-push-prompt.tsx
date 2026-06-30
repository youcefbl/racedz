"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CoachCopy } from "@/components/coach/copy";
import { Button } from "@/components/ui/button";
import { enableBrowserPush, getStoredPushToken, isPushBrowserReady, isPushConfigured } from "@/lib/notifications/push-client";

// Soft-ask to enable push (so coach reminders actually reach the runner). Decided in an effect,
// not during render, so server and client markup match and there is no hydration mismatch.
export function CoachPushPrompt({ copy }: { copy: CoachCopy }) {
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (
      !getStoredPushToken() &&
      isPushConfigured() &&
      isPushBrowserReady() &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  async function enable() {
    setWorking(true);
    setStatus(null);
    const result = await enableBrowserPush();
    setWorking(false);
    if (result.ok) {
      setVisible(false);
      return;
    }
    setStatus(result.reason === "permission" ? copy.pushDenied : copy.pushFailed);
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-teal">
          <Bell className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-black text-gray-950">{copy.pushPromptTitle}</p>
          <p className="mt-1 text-sm leading-6 text-gray-700">{copy.pushPromptText}</p>
          {status ? <p className="mt-1 text-sm font-semibold text-red-700">{status}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <Button type="button" size="sm" onClick={enable} disabled={working}>
          {working ? copy.saving : copy.pushEnable}
        </Button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={copy.dismiss}
          className="flex size-9 items-center justify-center rounded-md text-gray-500 transition hover:bg-white hover:text-gray-700"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
