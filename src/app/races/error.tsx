"use client";

import { RouteError } from "@/components/ui/route-error";

export default function RacesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="We couldn't load races" description="The race list is temporarily unavailable. This is usually a brief hiccup — please try again." homeHref="/" />;
}
