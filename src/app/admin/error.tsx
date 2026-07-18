"use client";

import { RouteError } from "@/components/ui/route-error";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="We couldn't load this admin page" description="Something went wrong. Please try again." homeHref="/admin" />;
}
