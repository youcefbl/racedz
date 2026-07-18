"use client";

import { RouteError } from "@/components/ui/route-error";

export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="We couldn't load your account" description="Something went wrong loading this page. Please try again." homeHref="/" />;
}
