import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Content Security Policy tuned for ZidRun's actual dependencies:
// - inline theme script in the root layout + Tailwind inline styles ('unsafe-inline')
// - Firebase messaging SW imports from gstatic; FCM token registration to googleapis
// - Google sign-in + Google-hosted avatars (https: images)
// Tighten with nonces later once verified end-to-end.
// Next.js dev mode (HMR / React Refresh) evaluates code via eval() and talks to the dev
// server over a websocket — both blocked by the production-strength policy. Loosen ONLY in
// development so the local build runs inside the Capacitor webview; production stays strict.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.gstatic.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.sentry.io${isDev ? " ws: http://10.0.2.2:3003" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://accounts.google.com"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()" }
];

const nextConfig: NextConfig = {
  output: "standalone",
  // User uploads live on a runtime volume served directly by Caddy at /uploads/*.
  // Disable the Next image optimizer so <Image> loads those sources directly instead
  // of proxying through /_next/image (which fetches from the app and would 404 on
  // runtime-written files). Also lighter on CPU/RAM for a small VPS.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default withSentryConfig(nextConfig, {
  // Source-map upload runs only when these are set (CI/production); otherwise it's skipped.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Proxy events through the app's own origin → avoids ad-blockers and keeps CSP at 'self'.
  tunnelRoute: "/monitoring",
  disableLogger: true,
  widenClientFileUpload: true,
  // Don't serve source maps to users; they're uploaded to Sentry (when a token is set) then removed.
  sourcemaps: { deleteSourcemapsAfterUpload: true }
});
