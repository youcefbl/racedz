"use client";

import { RouteError } from "@/components/ui/route-error";

export default function RankingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="We couldn't load the rankings" description="Rankings are temporarily unavailable. Please try again." homeHref="/" />;
}
