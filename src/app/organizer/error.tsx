"use client";

import { RouteError } from "@/components/ui/route-error";

export default function OrganizerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="We couldn't load this page" description="Something went wrong. Please try again." homeHref="/organizer" />;
}
