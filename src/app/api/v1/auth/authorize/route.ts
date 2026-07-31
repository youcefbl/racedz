import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { sha256 } from "@/lib/api/v1/tokens";

export const dynamic = "force-dynamic";

// OAuth 2.0 authorization endpoint for the native app's system-browser sign-in (RFC 6749 §4.1 with
// PKCE, RFC 7636). The app never sees the user's Google credentials and never embeds a WebView:
//
//   1. app generates code_verifier, opens this URL in a Custom Tab with S256(code_verifier)
//   2. no web session here -> redirect to the ordinary /login page, which already handles
//      credentials, "Continue with Google", blocked accounts, and the MFA second-factor page
//   3. session established -> mint a single-use code bound to that challenge
//   4. redirect back to the app over zidrun://auth/callback?code=...&state=...
//   5. app posts code + code_verifier to /api/v1/auth/token (see ../token/route.ts)
//
// Because the code only becomes tokens when paired with the verifier — which never leaves the app's
// process — another app that registers the same custom scheme and intercepts the redirect gets a
// value it cannot spend. That is the entire reason for PKCE here.

/** Only these targets may receive a code. An open redirect here would hand codes to any app. */
const ALLOWED_REDIRECT_URIS = new Set(["zidrun://auth/callback"]);

const CODE_TTL_MS = 2 * 60 * 1000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const method = url.searchParams.get("code_challenge_method") ?? "S256";
  const state = url.searchParams.get("state") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "zidrun://auth/callback";

  if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) {
    // Never redirect to an unknown target, not even to report the error — answer in-page instead.
    return htmlError("This sign-in link is not valid.");
  }
  // "plain" is refused: it offers no protection at all if the authorization request is observed.
  if (method !== "S256" || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeChallenge)) {
    return redirectToApp(redirectUri, { error: "invalid_request", state });
  }
  if (!/^[A-Za-z0-9._~-]{8,128}$/.test(state)) {
    return redirectToApp(redirectUri, { error: "invalid_request", state: "" });
  }

  const session = await auth();
  if (!session?.user?.id) {
    // Hand off to the website's own login page and come straight back here afterwards. Everything
    // that makes web sign-in safe (rate limits, MFA, blocked accounts, email verification) applies
    // unchanged; this endpoint deliberately implements none of it a second time.
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("callbackUrl", `${url.pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const blocked = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { blockedAt: true }
  });
  if (blocked?.blockedAt) {
    return redirectToApp(redirectUri, { error: "access_denied", state });
  }

  const code = randomBytes(32).toString("base64url");
  await getPrisma().mobileAuthCode.create({
    data: {
      userId: session.user.id,
      codeHash: sha256(code),
      codeChallenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS)
    }
  });

  return redirectToApp(redirectUri, { code, state });
}

function redirectToApp(redirectUri: string, params: Record<string, string>): NextResponse {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) target.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(target.toString(), 302);
  // The code is in this URL; keep it out of every cache between here and the browser.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function htmlError(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>ZidRun</title><p style="font-family:system-ui;padding:24px">${message}</p>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}
