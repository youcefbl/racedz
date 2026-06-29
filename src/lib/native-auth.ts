import { randomBytes } from "crypto";
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
