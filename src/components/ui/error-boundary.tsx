"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ReactNode } from "react";
import { reportClientError } from "@/lib/client-error-report";

/**
 * Scopes a crash to one subtree instead of taking down the whole route (which is what
 * happens by default: an uncaught client throw bubbles to the nearest route-level
 * `error.tsx`, replacing everything else on the page). Use around a component that reads
 * risky client-persisted state (e.g. a resumed in-progress recording) so a bad snapshot
 * shows a small inline fallback instead of an unrelated page going blank.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; boundary: string; fallback: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error);
    reportClientError({
      error,
      route: typeof window !== "undefined" ? window.location.pathname : "",
      boundary: this.props.boundary
    });
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}
