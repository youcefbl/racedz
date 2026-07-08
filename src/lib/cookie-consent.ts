// Client-side cookie-consent state. "accepted" and "rejected" are explicit choices; a missing
// value means the user hasn't chosen yet. We use a notice-and-choice model: analytics run by
// default, but an explicit "rejected" is honored (see AnalyticsTracker). Pure client helpers.

export const CONSENT_COOKIE = "zr_consent";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type CookieConsent = "accepted" | "rejected";

export function readCookieConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "accepted" || value === "rejected" ? value : null;
}

export function writeCookieConsent(value: CookieConsent) {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
  try {
    localStorage.setItem(CONSENT_COOKIE, value);
  } catch {
    /* storage blocked — the cookie is the source of truth anyway */
  }
}
