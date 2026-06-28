"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15803D",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          textAlign: "center",
          padding: "24px"
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 22px", opacity: 0.85 }}>An unexpected error occurred. Please try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              cursor: "pointer",
              background: "#F47A20",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              padding: "12px 22px",
              borderRadius: 10
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
