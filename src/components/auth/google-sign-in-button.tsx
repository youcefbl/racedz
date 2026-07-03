"use client";

import { Capacitor } from "@capacitor/core";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  callbackUrl,
  webClientId,
  label = "Continue with Google",
  pendingLabel = "Opening Google...",
  errorLabel = "Google sign-in failed. Please try again."
}: {
  callbackUrl?: string;
  // The web OAuth client ID (process.env.AUTH_GOOGLE_ID), passed from the server page.
  // Required for native sign-in: it's the audience of the idToken our backend verifies.
  webClientId?: string;
  label?: string;
  pendingLabel?: string;
  errorLabel?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Standard web Google OAuth (runs in a real browser via redirect).
  async function startWebGoogle() {
    setPending(true);
    await signIn("google", { callbackUrl: getCallbackUrl(callbackUrl) });
  }

  // Native app: use the OS Google account sheet (Credential Manager) instead of a
  // browser handoff — Google blocks OAuth in embedded WebViews, and routing through
  // the browser fought with our verified App Links. The plugin returns a Google
  // idToken; our backend verifies it and mints a session token we exchange here.
  async function startNativeGoogle() {
    setError(null);
    setPending(true);
    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      if (!webClientId) throw new Error("Google is not configured.");

      await SocialLogin.initialize({ google: { webClientId } });
      const { result } = await SocialLogin.login({ provider: "google", options: { forceRefreshToken: true } });
      const idToken = result.responseType === "online" ? result.idToken : null;
      if (!idToken) throw new Error("No Google idToken returned.");

      const response = await fetch("/api/auth/native/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken })
      });
      if (!response.ok) throw new Error("Token exchange failed.");
      const { token } = (await response.json()) as { token?: string };
      if (!token) throw new Error("No session token returned.");

      const signInResult = await signIn("native-bridge", { token, redirect: false });
      if (!signInResult || signInResult.error) throw new Error("Session creation failed.");

      window.location.assign(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/account");
    } catch (caught) {
      // A user cancelling the account sheet also lands here — just reset quietly unless
      // it was a real failure worth surfacing.
      const message = caught instanceof Error ? caught.message : "";
      const cancelled = /cancel|dismiss|closed|13\b/i.test(message);
      setError(cancelled ? null : errorLabel);
      setPending(false);
    }
  }

  function handleClick() {
    if (Capacitor.isNativePlatform()) {
      void startNativeGoogle();
      return;
    }
    void startWebGoogle();
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" size="lg" className="w-full justify-center" disabled={pending} onClick={handleClick}>
        <span className="flex size-5 items-center justify-center rounded-full bg-white text-sm font-semibold text-gray-950 shadow-sm" aria-hidden="true">
          G
        </span>
        {pending ? pendingLabel : label}
      </Button>
      {error ? <p className="text-center text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}

function getCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl) {
    return "/login";
  }

  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
