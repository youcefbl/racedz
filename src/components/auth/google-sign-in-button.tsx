"use client";

import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const SITE_ORIGIN = "https://zidrun.com";

export function GoogleSignInButton({
  callbackUrl,
  native = false,
  label = "Continue with Google",
  pendingLabel = "Opening Google..."
}: {
  callbackUrl?: string;
  // True when this button is rendered in the system browser as part of the native
  // sign-in flow (?native=1): the post-OAuth redirect routes through the deep-link handoff.
  native?: boolean;
  label?: string;
  pendingLabel?: string;
}) {
  const [pending, setPending] = useState(false);

  // Standard web Google OAuth (runs in a real browser). In the native flow we send
  // the user to the deep-link handoff instead of straight to their account.
  async function startWebGoogle() {
    setPending(true);
    const target = native
      ? `/auth/native/handoff${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`
      : getCallbackUrl(callbackUrl);
    await signIn("google", { callbackUrl: target });
  }

  async function handleClick() {
    // Google blocks OAuth inside embedded WebViews, so from the native app we hand
    // off to the system browser, which finishes via the zidrun://auth deep link.
    if (Capacitor.isNativePlatform()) {
      setPending(true);
      try {
        const { Browser } = await import("@capacitor/browser");
        const url = new URL("/login", SITE_ORIGIN);
        url.searchParams.set("native", "1");
        if (callbackUrl) url.searchParams.set("callbackUrl", callbackUrl);
        await Browser.open({ url: url.toString() });
      } finally {
        setPending(false);
      }
      return;
    }

    await startWebGoogle();
  }

  return (
    <Button type="button" variant="outline" size="lg" className="w-full justify-center" disabled={pending} onClick={handleClick}>
      <span className="flex size-5 items-center justify-center rounded-full bg-white text-sm font-semibold text-gray-950 shadow-sm" aria-hidden="true">
        G
      </span>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function getCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl) {
    return "/login";
  }

  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
