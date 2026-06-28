"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  callbackUrl,
  label = "Continue with Google",
  pendingLabel = "Opening Google..."
}: {
  callbackUrl?: string;
  label?: string;
  pendingLabel?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await signIn("google", {
      callbackUrl: getCallbackUrl(callbackUrl)
    });
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
