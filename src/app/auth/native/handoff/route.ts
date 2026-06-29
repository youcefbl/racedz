import { auth } from "@/auth";
import { createNativeAuthToken } from "@/lib/native-auth";

export const dynamic = "force-dynamic";

// Landing point for the native Google sign-in flow. The app opens the website in
// the system browser; after a normal web Google login NextAuth redirects here.
// We mint a one-time token for the now-authenticated user and bounce the system
// browser to the zidrun://auth deep link, which re-opens the app. The app's
// WebView then exchanges the token for its own session (see native-deep-links.tsx).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = sanitizeInternalPath(url.searchParams.get("callbackUrl")) ?? "/account";
  const session = await auth();

  if (!session?.user?.id) {
    // Opened without a session — start the web sign-in, then return here.
    const login = new URL("/login", url.origin);
    login.searchParams.set("native", "1");
    login.searchParams.set("callbackUrl", callbackUrl);
    return Response.redirect(login.toString(), 302);
  }

  const token = await createNativeAuthToken(session.user.id);
  const deepLink = `zidrun://auth?token=${encodeURIComponent(token)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return new Response(renderHandoffPage(deepLink), {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function sanitizeInternalPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function renderHandoffPage(deepLink: string): string {
  const safe = deepLink.replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safe}" />
  <title>Returning to ZidRun…</title>
  <style>
    html,body{height:100%;margin:0}
    body{display:flex;align-items:center;justify-content:center;background:#0c1116;color:#f2ddff;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px}
    a{display:inline-block;margin-top:20px;padding:12px 22px;border-radius:12px;background:#15803D;
      color:#fff;text-decoration:none;font-weight:600}
    p{opacity:.8;max-width:30ch;line-height:1.5}
  </style>
</head>
<body>
  <div>
    <p>Signing you in to the ZidRun app…</p>
    <a href="${safe}">Open the app</a>
  </div>
  <script>location.replace(${JSON.stringify(deepLink)});</script>
</body>
</html>`;
}
