import { randomBytes } from "crypto";
import type { TokenPayload } from "google-auth-library";
import { getPrisma } from "@/lib/db";
import type { UserRole } from "@/types/race";

// Bridges a web (system-browser) Google sign-in into the native app's webview
// session. The system browser and the app's WebView do NOT share cookies, so we
// mint a short-lived, single-use token after the web OAuth completes, hand it to
// the app via the zidrun://auth deep link, and let the "native-bridge" credentials
// provider exchange it for a real NextAuth session inside the WebView.

const TOKEN_TTL_MS = 1000 * 60 * 5; // 5 minutes — just long enough to round-trip.

export type NativeAuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationIds: string[];
};

export async function createNativeAuthToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");

  await getPrisma().nativeAuthToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
    }
  });

  return token;
}

// Find-or-create a user from a verified Google idToken payload (native sign-in), then
// return the user id so the caller can mint a native-auth token. Mirrors the web Google
// provisioning in auth.ts (getOrCreateGoogleUser) so both sign-in paths behave identically.
export async function upsertGoogleUserFromPayload(payload: TokenPayload): Promise<string> {
  const email = payload.email?.toLowerCase();
  if (!email) throw new Error("Google token has no email.");

  const prisma = getPrisma();
  const now = new Date();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true, avatarUrl: true, firstLoginAt: true }
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        lastLoginAt: now,
        firstLoginAt: existing.firstLoginAt ?? now,
        ...(existing.emailVerifiedAt ? {} : { emailVerifiedAt: now }),
        ...(!existing.avatarUrl && payload.picture ? { avatarUrl: payload.picture } : {})
      }
    });
    return existing.id;
  }

  const parts = (payload.name ?? email).trim().split(/\s+/).filter(Boolean);
  const firstName = payload.given_name?.trim() || parts[0] || "ZidRun";
  const lastName = payload.family_name?.trim() || parts.slice(1).join(" ") || "Runner";
  const created = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      avatarUrl: payload.picture ?? undefined,
      emailVerifiedAt: now,
      firstLoginAt: now,
      lastLoginAt: now,
      role: "RUNNER"
    },
    select: { id: true }
  });
  return created.id;
}

export async function consumeNativeAuthToken(token: string): Promise<NativeAuthUser | null> {
  if (!token || token.length < 32) return null;

  const prisma = getPrisma();
  const row = await prisma.nativeAuthToken.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          organizations: { select: { organizationId: true } }
        }
      }
    }
  });

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  // Single-use: atomically claim it. If a concurrent request already did, bail.
  const claimed = await prisma.nativeAuthToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() }
  });

  if (claimed.count !== 1) return null;

  const user = row.user;
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role: user.role as UserRole,
    organizationIds: user.organizations.map((member) => member.organizationId)
  };
}
