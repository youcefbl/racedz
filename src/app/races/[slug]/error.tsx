"use client";

import { RouteError } from "@/components/ui/route-error";

export default function RaceDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="We couldn't load this race" description="The race details are temporarily unavailable. Please try again — the race has not been removed." homeHref="/races" />;
}
