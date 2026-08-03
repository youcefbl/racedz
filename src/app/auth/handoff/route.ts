import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getPrisma } from "@/lib/db";
import { peekWebHandoffToken } from "@/lib/native-auth";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

// Web side of the app→browser handoff (NATPAR-002). The native app mints a single-use token via
// POST /api/v1/auth/web-handoff and opens this URL in a Custom Tab.
//
// Two-step by design (DD6-R02 — login CSRF): merely LOADING a handoff URL must not change auth
// state, because a URL travels — it can be sent to a victim, prefetched by a link scanner, or
// embedded in a page. So GET only peeks the token (pure read) and renders a confirmation page
// naming the account and destination; the actual sign-in happens on the POST from that page's
// button, which requires a same-origin user gesture. The token is only spent on POST.
//
// Failure modes fall back to the normal login with the destination preserved where known: an
// expired, reused, or foreign token costs the runner one manual sign-in, never an error page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const peek = token ? await peekWebHandoffToken(token) : null;
  if (!peek) {
    logSecurityEvent("web_handoff_rejected", { stage: "peek", reason: "invalid_or_expired" });
    redirect("/login");
  }

  return new Response(confirmationPage(token, peek.email, peek.destination), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // A sign-in confirmation must never be served stale or from a shared cache.
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function POST(request: Request) {
  // Same-origin gesture required: the form on our own confirmation page is the only legitimate
  // submitter. A cross-site form post (the classic login-CSRF vector) fails here.
  if (!isSameOrigin(request)) {
    logSecurityEvent("web_handoff_rejected", { stage: "confirm", reason: "cross_origin" });
    redirect("/login");
  }

  const form = await request.formData().catch(() => null);
  const token = typeof form?.get("token") === "string" ? (form.get("token") as string) : "";

  const peek = token ? await peekWebHandoffToken(token) : null;
  if (!peek) {
    logSecurityEvent("web_handoff_rejected", { stage: "confirm", reason: "invalid_or_expired" });
    redirect("/login");
  }
  const destination = peek.destination;

  // The minting mobile session must still be alive: a runner who wipes their sessions from the
  // security page (stolen phone) must not leave a live handoff link behind.
  if (peek.mobileSessionFamilyId) {
    const session = await getPrisma().mobileSession.findFirst({
      where: { familyId: peek.mobileSessionFamilyId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!session) {
      logSecurityEvent("web_handoff_rejected", { stage: "confirm", reason: "mobile_session_revoked" });
      redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
    }
  }

  try {
    // Success: NextAuth consumes the token (single-use), sets the session cookie, and throws its
    // redirect to the destination stored at mint time.
    await signIn("native-bridge", { token, purpose: "WEB_HANDOFF", redirectTo: destination });
  } catch (error) {
    // Next's redirect() and NextAuth's success redirect both travel as throwables — rethrow them.
    if (error instanceof Error && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      logSecurityEvent("web_handoff_consumed", { destination });
      throw error;
    }
    // Invalid/expired/spent token: degrade to the login page, destination preserved.
    logSecurityEvent("web_handoff_rejected", { stage: "confirm", reason: "consume_failed" });
    redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  }

  logSecurityEvent("web_handoff_consumed", { destination });
  redirect(destination);
}

function isSameOrigin(request: Request): boolean {
  // Sec-Fetch-Site is the modern signal; Origin is the fallback for browsers that omit it.
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

// Deliberately dependency-free HTML (this is a route handler, not a page): one screen, one
// action. Trilingual inline because the browser has no app locale context at this point.
function confirmationPage(token: string, email: string, destination: string): string {
  const maskedEmail = maskEmail(email);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ZidRun</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
  main { background: #1e293b; border-radius: 12px; padding: 2rem; max-width: 22rem; width: calc(100% - 2rem); text-align: center; }
  h1 { font-size: 1.1rem; margin: 0 0 0.75rem; }
  p { font-size: 0.9rem; color: #94a3b8; margin: 0.4rem 0; }
  .account { color: #e2e8f0; font-weight: 600; }
  button { margin-top: 1.25rem; width: 100%; padding: 0.75rem; border: 0; border-radius: 8px; background: #22c55e; color: #052e16; font-size: 1rem; font-weight: 700; cursor: pointer; }
  a { display: inline-block; margin-top: 0.9rem; color: #64748b; font-size: 0.8rem; }
</style>
</head>
<body>
<main>
  <h1>Continuer sur ZidRun · Continue to ZidRun · <span dir="rtl">المتابعة إلى ZidRun</span></h1>
  <p>Connexion en tant que · Sign in as</p>
  <p class="account">${escapeHtml(maskedEmail)}</p>
  <p>Destination : <span class="account">${escapeHtml(destination)}</span></p>
  <form method="post">
    <input type="hidden" name="token" value="${escapeHtml(token)}">
    <button type="submit">Continuer · Continue · متابعة</button>
  </form>
  <a href="/login">Ce n'est pas moi · Not me · ليس أنا</a>
</main>
</body>
</html>`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
