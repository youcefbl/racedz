import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export const dynamic = "force-dynamic";

// Web side of the app→browser handoff (NATPAR-002). The native app mints a single-use token via
// POST /api/v1/auth/web-handoff and opens this URL in a Custom Tab; exchanging the token through
// the existing "native-bridge" credentials provider signs the BROWSER in (cookie session) and
// forwards to `next` — so subscribe/payment, security/MFA, and support land on the page instead of
// a login wall. The mirror of /auth/native/handoff, which bridges the other way (web → WebView).
//
// Failure modes fall back to the normal login with the destination preserved: an expired, reused,
// or foreign token costs the runner one manual sign-in, never an error page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = sanitizeInternalPath(url.searchParams.get("next")) ?? "/account";

  if (!token) {
    redirect(`/login?callbackUrl=${encodeURIComponent(next)}`);
  }

  try {
    // Success: NextAuth sets the session cookie and throws its redirect to `next`.
    await signIn("native-bridge", { token, redirectTo: next });
  } catch (error) {
    // Next's redirect() and NextAuth's success redirect both travel as throwables — rethrow them.
    if (error instanceof Error && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    // Invalid/expired/spent token: degrade to the login page, destination preserved.
    redirect(`/login?callbackUrl=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

function sanitizeInternalPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
