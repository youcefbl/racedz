import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { getPrisma } from "@/lib/db";
import { createNativeAuthToken, upsertGoogleUserFromPayload } from "@/lib/native-auth";

export const dynamic = "force-dynamic";

// Native Google sign-in exchange. The app signs in with the native Google account
// sheet (Credential Manager) and posts the resulting Google idToken here. We verify it
// against our Google client ID, find-or-create the user, and hand back a one-time
// native-auth token that the app's WebView swaps for a real session via the
// "native-bridge" credentials provider (same token plumbing as the web handoff).
export async function POST(request: Request) {
  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }

  let idToken: string | null = null;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    idToken = typeof body?.idToken === "string" ? body.idToken : null;
  } catch {
    /* invalid JSON — handled below */
  }
  if (!idToken) {
    return NextResponse.json({ error: "Missing Google idToken." }, { status: 400 });
  }

  // Verify the token's signature and audience (our client ID) against Google's certs.
  let payload;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return NextResponse.json({ error: "Invalid Google token." }, { status: 401 });
  }

  if (!payload?.email || payload.email_verified !== true) {
    return NextResponse.json({ error: "Google account email is not verified." }, { status: 401 });
  }

  // Blocked accounts cannot sign in via Google either (matches the web signIn callback).
  const existing = await getPrisma().user.findUnique({
    where: { email: payload.email.toLowerCase() },
    select: { blockedAt: true }
  });
  if (existing?.blockedAt) {
    return NextResponse.json({ error: "This account is blocked." }, { status: 403 });
  }

  const userId = await upsertGoogleUserFromPayload(payload);
  const token = await createNativeAuthToken(userId);
  return NextResponse.json({ token });
}
