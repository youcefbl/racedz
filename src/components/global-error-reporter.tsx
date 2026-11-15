"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-report";

// Catches what React error boundaries can't: errors thrown from event handlers, timers, and
// other code outside a render pass, plus unhandled promise rejections. Mounted once in the root
// layout so it's active on every route, not just the ones with a scoped ErrorBoundary.
// React's recoverable hydration errors (#418 text/HTML mismatch, #419 Suspense fallback, #423,
// #425) surface here via reportError(). React re-renders the subtree on the client and the page
// keeps working; most are caused by the visitor's browser (translation, extensions, autofill)
// editing the DOM before hydration. Log them under their own boundary, once per page load, so
// they don't drown out real crashes in /admin/errors.
const HYDRATION_ERROR = /Minified React error #(418|419|423|425)\b|Hydration failed|hydrat(ed|ion) .*(mismatch|didn't match)/i;

export function GlobalErrorReporter() {
  useEffect(() => {
    let hydrationReported = false;
    const onError = (event: ErrorEvent) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || "Unknown window error");
      if (HYDRATION_ERROR.test(error.message)) {
        if (hydrationReported) return;
        hydrationReported = true;
        reportClientError({ error, route: window.location.pathname, boundary: "hydration", context: { recoverable: true } });
        return;
      }
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
