/**
 * The site's own public origin, for links that leave the server and have to work from outside.
 *
 * Behind the production reverse proxy, a request's own host is the address Next is bound to, not
 * the address a browser can reach. Anything that builds an absolute URL from `request.url` therefore
 * risks emitting something like `https://0.0.0.0:3003` — which is exactly how the native app's
 * browser sign-in broke: `/api/v1/auth/authorize` redirected the Custom Tab to the bind address and
 * the runner got a connection error instead of the login page.
 *
 * `NEXTAUTH_URL` / `AUTH_URL` is what the rest of the app (password reset, email verification,
 * notifications, broadcasts) already treats as canonical, and NextAuth resolves the same value for
 * its own callbacks. [requestOrigin] is only a development fallback, for running without either set.
 */
export function canonicalOrigin(requestOrigin: string): string {
  const configured = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  if (!configured) return requestOrigin;
  try {
    // Normalises away a trailing slash and rejects a malformed value rather than producing a URL
    // that silently points somewhere else.
    return new URL(configured).origin;
  } catch {
    return requestOrigin;
  }
}
