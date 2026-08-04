import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { peekWebHandoffToken } from "@/lib/native-auth";
import { getLocale, withLocale } from "@/lib/i18n";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

/**
 * Web side of the app→browser handoff (NATPAR-002), step 2 of 2: the confirmed exchange.
 *
 * Split from the interstitial at /auth/handoff so that establishing a session is a POST and only a
 * POST — a link alone can never sign anyone in (DD6-R02), and this file is state-changing by
 * definition, matching the repository's "no state-changing GET" rule.
 *
 * Every credential condition — token purpose, expiry, single use, the security stamp in force when
 * it was minted, the account's blocked state, and a live unrevoked mobile session owned by the same
 * user — is validated inside consumeNativeAuthToken(), in the same transaction that claims the
 * token (FD1-R01). This route deliberately re-checks none of it: a second read here would only
 * reopen the check-then-consume window that design closes.
 */
export async function POST(request: Request) {
  // The form on our own confirmation page is the only legitimate submitter; a cross-site form post
  // is the classic login-CSRF vector.
  if (!isSameOrigin(request)) {
    logSecurityEvent("web_handoff_rejected", { stage: "confirm", reason: "cross_origin" });
    redirect("/login");
  }

  const form = await request.formData().catch(() => null);
  const token = typeof form?.get("token") === "string" ? (form.get("token") as string) : "";
  const locale = getLocale(typeof form?.get("lang") === "string" ? (form.get("lang") as string) : null);
  const loginUrl = withLocale("/login", locale);

  // Read-only, purely to know where to send the browser afterwards. Not a gate.
  const peek = token ? await peekWebHandoffToken(token) : null;
  if (!peek) {
    logSecurityEvent("web_handoff_rejected", { stage: "confirm", reason: "invalid_or_expired" });
    redirect(loginUrl);
  }
  const destination = peek.destination;

  try {
    // Success: NextAuth consumes the token (single use), sets the session cookie, and throws its
    // redirect to the destination bound at mint time.
    await signIn("native-bridge", { token, purpose: "WEB_HANDOFF", redirectTo: destination });
  } catch (error) {
    // Next's redirect() and NextAuth's success redirect both travel as throwables — rethrow them.
    if (error instanceof Error && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      logSecurityEvent("web_handoff_consumed", { destination });
      throw error;
    }
    // Refused (expired, spent, revoked device, stamp moved, blocked account): degrade to login with
    // the destination preserved. The reason is deliberately not disclosed to the browser.
    logSecurityEvent("web_handoff_rejected", { stage: "confirm", reason: "consume_failed" });
    redirect(`${loginUrl}${loginUrl.includes("?") ? "&" : "?"}callbackUrl=${encodeURIComponent(destination)}`);
  }

  logSecurityEvent("web_handoff_consumed", { destination });
  redirect(destination);
}

/** A GET here is someone reloading or sharing the POST URL — send them to sign in normally. */
export async function GET() {
  redirect("/login");
}

function isSameOrigin(request: Request): boolean {
  // Sec-Fetch-Site is the modern signal; Origin is the fallback for clients that omit it.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
