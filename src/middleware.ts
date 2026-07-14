import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
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

function applyLocale(request: NextRequest): NextResponse {
  // Only act on top-level page GET navigations.
  if (request.method !== "GET") return NextResponse.next();

  const { searchParams } = request.nextUrl;
  const explicit = searchParams.get("lang");

  if (explicit !== null) {
    const response = NextResponse.next();
    response.cookies.set(LOCALE_COOKIE, isLocale(explicit) ? explicit : "en", {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax"
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

  return NextResponse.next();
}

export default auth((request) => {
  const { nextUrl } = request;
  const path = nextUrl.pathname;

  // 1) Auth guard for the private areas. Runs on every method (as the original guard did),
  //    so it also covers server-action POSTs to these page routes.
  if (isProtectedPath(path)) {
    const role = request.auth?.user?.role;

    if (!request.auth?.user) {
      const loginUrl = new URL("/login", nextUrl);
      loginUrl.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(loginUrl);
    }

    if (path.startsWith("/admin") && (!role || !adminRoles.includes(role))) {
      return NextResponse.redirect(new URL("/account", nextUrl));
    }

    // /organizer/request is the "apply to become an organizer" page — reachable by any
    // signed-in user; every other /organizer route requires an organizer role.
    if (
      path !== "/organizer/request" &&
      path.startsWith("/organizer") &&
      (!role || !organizerRoles.includes(role))
    ) {
      return NextResponse.redirect(new URL("/organizer/request", nextUrl));
    }
  }

  // 2) Locale persistence for everything that wasn't redirected by the guard above.
  return applyLocale(request);
});

export const config = {
  // Skip API, Next internals, and any file with an extension (icons, manifest, sw, images).
  // This superset covers the private areas too, so the auth guard runs on them.
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
