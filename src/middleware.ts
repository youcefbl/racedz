import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { logSecurityEvent } from "@/lib/security-log";
import type { UserRole } from "@/types/race";

// The single Next.js middleware. Next runs at most one middleware file, and when a
// src/ directory is present it uses THIS one — so both the auth route-guard and locale
// persistence have to live here. (A stale root-level middleware.ts once held the auth
// guard but never ran because src/middleware.ts shadowed it; it has been removed.)
//
// Auth uses an edge-safe NextAuth instance built from auth.config.ts (no Prisma /
// server-only imports) purely to decode the JWT and read the signed-in user's role.
const { auth } = NextAuth(authConfig);

const organizerRoles: UserRole[] = ["ORGANIZER", "ADMIN", "SUPERADMIN"];
const adminRoles: UserRole[] = ["ADMIN", "SUPERADMIN"];

const isProtectedPath = (path: string) =>
  path === "/account" ||
  path.startsWith("/account/") ||
  path === "/organizer" ||
  path.startsWith("/organizer/") ||
  path === "/admin" ||
  path.startsWith("/admin/");

// Locale persistence + Algeria-first default (behavior unchanged from the previous
// locale-only middleware):
// - When a request carries ?lang, persist it to a cookie.
// - When it does not, pick the locale from the cookie (prior choice) or the browser's
//   Accept-Language, and redirect to the same URL with ?lang set so the query-string-based
//   pages/components stay in sync. English is the default and never needs a redirect.
// Only acts on top-level page GET navigations.
const LOCALE_COOKIE = "racedz-locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

type Locale = "en" | "fr" | "ar";

function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "fr" || value === "ar";
}

function detectAcceptLanguage(header: string | null): Locale {
  if (!header) return "en";
  for (const part of header.split(",")) {
    const code = part.trim().split(";")[0].slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return "en";
}

function resolvePublicOrigin(request: NextRequest): string {
  // Next's standalone server can expose its internal `localhost` origin through
  // request.nextUrl. Resolve the browser-facing origin from the proxy headers instead —
  // this backs both the absolute-URL redirect below (Auth.js requires one during
  // credential sign-in) and the cross-origin API guard's same-origin comparison.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  // Next standalone synthesizes x-forwarded-host as `localhost`; Caddy preserves
  // the incoming Host header, so prefer Host and retain x-forwarded-host as fallback.
  const host = request.headers.get("host") || forwardedHost;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : request.nextUrl.protocol.replace(":", "");
  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  return configuredUrl
    ? new URL(configuredUrl).origin
    : host
      ? `${protocol}://${host}`
      : request.nextUrl.origin;
}

function publicOriginRedirect(request: NextRequest, url: URL): NextResponse {
  const redirectUrl = new URL(`${url.pathname}${url.search}${url.hash}`, resolvePublicOrigin(request));
  return NextResponse.redirect(redirectUrl);
}

// SEC-005: explicit origin/fetch-metadata check for state-changing API requests. Auth.js's
// session cookie is already SameSite=Lax (blocks it on cross-site POSTs in modern browsers),
// so this is defense in depth against browsers/clients that don't honor SameSite. Only guards
// requests that carry the session cookie — bearer/native-token auth (e.g. the native Google
// handoff route) has no ambient credential for a cross-site request to ride on, so it's not
// CSRF-able and is left alone.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.get(name)?.value);
}

function applyApiOriginGuard(request: NextRequest): NextResponse {
  if (SAFE_METHODS.has(request.method) || !hasSessionCookie(request)) {
    return NextResponse.next();
  }

  // Fetch metadata (sent by all current browser engines) is the primary signal: same-origin/
  // none means the request came from this site or a direct client, not another site's page.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return NextResponse.next();
  if (fetchSite) {
    logSecurityEvent("cross_site_request_blocked", { path: request.nextUrl.pathname, method: request.method, fetchSite });
    return new NextResponse("Cross-site request blocked", { status: 403 });
  }

  // No fetch-metadata header (older browser or non-browser client): fall back to comparing
  // Origin against this deployment's public origin when the client sent one.
  const origin = request.headers.get("origin");
  if (origin && origin !== resolvePublicOrigin(request)) {
    logSecurityEvent("cross_site_request_blocked", { path: request.nextUrl.pathname, method: request.method, origin });
    return new NextResponse("Cross-site request blocked", { status: 403 });
  }

  return NextResponse.next();
}

// SEC-005: nonce-based script-src instead of the previous static 'unsafe-inline'. The nonce
// must differ per request, and Next.js auto-nonces its own injected scripts by reading the
// Content-Security-Policy header back off the *request* object (see
// next/dist/server/app-render/get-script-nonce-from-header.js) — so it has to be set on both
// the forwarded request headers and the response headers, not only the response. 'strict-dynamic'
// lets those Next-injected scripts load further scripts (chunks, the dynamic gstatic Firebase
// messaging scripts in src/lib/notifications/push-client.ts) without host-listing every source;
// 'unsafe-inline'/https://www.gstatic.com stay as a fallback for browsers that don't support
// nonces/strict-dynamic (which ignore them once a nonce is present). style-src is intentionally
// left 'unsafe-inline': Tailwind's arbitrary-value utilities and component `style={}` attributes
// would need a much larger migration (inline style attributes can't carry a nonce at all — only
// hashes or 'unsafe-hashes' — and the XSS risk of attribute-style injection is far lower than
// script injection), tracked as a follow-up rather than blocking this pass.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.gstatic.com 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
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
}

// Builds the NextResponse that continues on to page rendering, with a fresh per-request CSP
// nonce threaded onto both the request (for Next's own auto-nonced scripts) and the response
// (for the browser to enforce). Every "let the page render" return path in this file should
// go through this instead of a bare NextResponse.next().
function nextWithNonce(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function applyLocale(request: NextRequest): NextResponse {
  // Only act on top-level page GET navigations.
  if (request.method !== "GET") return nextWithNonce(request);

  const { searchParams } = request.nextUrl;
  const explicit = searchParams.get("lang");

  if (explicit !== null) {
    const response = nextWithNonce(request);
    response.cookies.set(LOCALE_COOKIE, isLocale(explicit) ? explicit : "en", {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
      // Only over HTTPS — local dev runs on plain http://127.0.0.1, where a Secure cookie
      // would silently fail to be set at all.
      secure: process.env.NODE_ENV === "production"
    });
    return response;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const desired = isLocale(cookieLocale)
    ? cookieLocale
    : detectAcceptLanguage(request.headers.get("accept-language"));

  if (desired !== "en") {
    const url = request.nextUrl.clone();
    url.searchParams.set("lang", desired);
    return NextResponse.redirect(url);
  }

  return nextWithNonce(request);
}

export default auth((request) => {
  const { nextUrl } = request;
  const path = nextUrl.pathname;

  // 0) API routes get only the origin guard — no page auth-redirects or locale cookies apply.
  if (path.startsWith("/api/")) {
    return applyApiOriginGuard(request);
  }

  // 1) Auth guard for the private areas. Runs on every method (as the original guard did),
  //    so it also covers server-action POSTs to these page routes.
  if (isProtectedPath(path)) {
    const role = request.auth?.user?.role;

    if (!request.auth?.user) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("callbackUrl", path);
      return publicOriginRedirect(request, loginUrl);
    }

    if (path.startsWith("/admin") && (!role || !adminRoles.includes(role))) {
      return publicOriginRedirect(request, new URL("/account", nextUrl));
    }

    // /organizer/request is the "apply to become an organizer" page — reachable by any
    // signed-in user; every other /organizer route requires an organizer role.
    if (
      path !== "/organizer/request" &&
      path.startsWith("/organizer") &&
      (!role || !organizerRoles.includes(role))
    ) {
      return publicOriginRedirect(request, new URL("/organizer/request", nextUrl));
    }
  }

  // 2) Locale persistence for everything that wasn't redirected by the guard above.
  return applyLocale(request);
});

export const config = {
  // Skip Next internals and any file with an extension (icons, manifest, sw, images).
  // This superset covers the private areas and API routes too, so the auth guard and the
  // API origin guard both run on them.
  matcher: ["/((?!_next|.*\\..*).*)"]
};
