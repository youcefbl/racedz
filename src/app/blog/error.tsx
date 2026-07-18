"use client";

import { RouteError } from "@/components/ui/route-error";

export default function BlogError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} title="We couldn't load the blog" description="This article list is temporarily unavailable. Please try again." homeHref="/" />;
}
