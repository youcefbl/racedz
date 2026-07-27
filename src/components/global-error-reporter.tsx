"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";

// Catches what React error boundaries can't: errors thrown from event handlers, timers, and
// other code outside a render pass, plus unhandled promise rejections. Mounted once in the root
// layout so it's active on every route, not just the ones with a scoped ErrorBoundary.
export function GlobalErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || "Unknown window error");
      reportClientError({ error, route: window.location.pathname, boundary: "window.onerror" });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : "Unhandled promise rejection");
      reportClientError({ error, route: window.location.pathname, boundary: "unhandledrejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
