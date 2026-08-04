import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy is set per-request by src/middleware.ts (SEC-005: nonce-based
// script-src + 'strict-dynamic' instead of a static 'unsafe-inline', since the nonce must
// differ per request — next.config's headers() below has no per-request context to draw one
// from). Everything else that doesn't need a nonce stays here as a static header.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()" }
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Don't advertise the framework/version in responses (SEC-001: no framework/version banners).
  poweredByHeader: false,
  // Blog posts are MDX files read from src/content at runtime (the blog + sitemap render
  // dynamically for the ?lang param). Standalone tracing wouldn't copy these non-imported
  // files, so include them explicitly for the routes that read them.
  outputFileTracingIncludes: {
    "/blog": ["./src/content/blog/**/*"],
    "/blog/[slug]": ["./src/content/blog/**/*"],
    "/sitemap.xml": ["./src/content/blog/**/*"]
  },
  // User uploads live on a runtime volume served directly by Caddy at /uploads/*.
  // Disable the Next image optimizer so <Image> loads those sources directly instead
  // of proxying through /_next/image (which fetches from the app and would 404 on
  // runtime-written files). Also lighter on CPU/RAM for a small VPS.
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The app→browser handoff carries a five-minute sign-in credential in its query string, and
        // the site-wide strict-origin-when-cross-origin still sends the FULL url as the Referer on
        // same-origin requests — so the token could be copied into same-origin access/telemetry logs
        // by the page's own subresource requests (review F234-R03). no-referrer is the only policy
        // that keeps a secret-bearing URL out of them.
        source: "/auth/handoff/:path*",
        headers: [
          ...securityHeaders.filter((header) => header.key !== "Referrer-Policy"),
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" }
        ]
      }
    ];
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
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
  // Don't serve source maps to users; they're uploaded to Sentry (when a token is set) then removed.
  sourcemaps: { deleteSourcemapsAfterUpload: true }
});
