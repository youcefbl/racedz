/**
 * The site's own public address, for links and redirects that leave the server.
 *
 * Behind the production reverse proxy, a request's own host is the address Next is bound to, not the
 * address a browser can reach. Anything that builds an absolute URL from `request.url` therefore
 * risks emitting something like `https://0.0.0.0:3003` — which is exactly how the native app's
 * browser sign-in broke: `/api/v1/auth/authorize` redirected the Custom Tab to the bind address and
 * the runner got a connection error instead of the login page.
 *
 * **One precedence, because the auth paths used to disagree.** Three helpers each had their own
 * order and their own fallback: the authorize hand-off and the password-reset/verification links
 * read `NEXTAUTH_URL` first, while the email chrome read `NEXT_PUBLIC_APP_URL`, then `AUTH_URL`,
 * then `NEXTAUTH_URL`. With those variables set to different values, one password-reset email could
 * carry a link to one host and a logo from another. They now share this:
 *
 *   1. `NEXT_PUBLIC_APP_URL` — the deliberate override, when the public address is not the auth one
 *   2. `AUTH_URL`           — Auth.js v5's own name for it
 *   3. `NEXTAUTH_URL`       — the v4 name, still set in this deployment
 *
 * A caller's `fallback` is used only when none is set, so development without any of them keeps
 * working and each caller keeps the fallback that suits it.
 */
function configuredUrl(): string | null {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? null;
}

/**
 * Scheme, host and port only — for redirect targets, where a configured path would be wrong.
 */
export function canonicalOrigin(fallback: string): string {
  const configured = configuredUrl();
  if (!configured) return fallback;
  try {
    // Rejects a malformed value rather than producing a URL that silently points somewhere else.
    return new URL(configured).origin;
  } catch {
    return fallback;
  }
}

/**
 * The configured address with any trailing slash removed — for building links by concatenation,
 * where a deployment served under a sub-path needs that path preserved.
 */
export function canonicalBaseUrl(fallback: string): string {
  const configured = configuredUrl();
  if (!configured) return fallback.replace(/\/+$/, "");
  try {
    new URL(configured);
  } catch {
    return fallback.replace(/\/+$/, "");
  }
  return configured.replace(/\/+$/, "");
}
