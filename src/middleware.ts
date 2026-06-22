import { NextResponse, type NextRequest } from "next/server";

// Locale persistence + Algeria-first default.
// - When a request carries ?lang, persist it to a cookie.
// - When it does not, pick the locale from the cookie (prior choice) or the
//   browser's Accept-Language, and redirect to the same URL with ?lang set so
//   the existing query-string-based pages and client components stay in sync.
// English is the default and needs no ?lang, so we never redirect for it.

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

export function middleware(request: NextRequest) {
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

export const config = {
  // Skip API, Next internals, and any file with an extension (icons, manifest, sw, images).
  matcher: ["/((?!api|_next|.*\\..*).*)"]
};
