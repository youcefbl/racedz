"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Shared body for route-level `error.tsx` boundaries.
 *
 * Without a route-level boundary, any throw in a server component escalates to
 * `app/global-error.tsx`, which replaces the *entire* document — header, nav, and the
 * locale/direction the inline script set. A route boundary keeps the shell intact and turns a
 * failure into something the user can actually retry.
 *
 * Copy is intentionally English-only, matching `global-error.tsx`: this renders when something
 * has already gone wrong, so it must not depend on data loading (including a locale lookup).
 */
export function RouteError({
  error,
  reset,
  title = "Something went wrong",
  description = "We couldn't load this page. This is usually temporary — please try again.",
  homeHref = "/"
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center sm:px-6">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="size-6" aria-hidden={true} />
      </div>
      <h1 className="text-xl font-black text-gray-950">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">{description}</p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-gray-500">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="secondary" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href={homeHref} variant="outline">
          Go back
        </ButtonLink>
      </div>
    </div>
  );
}
