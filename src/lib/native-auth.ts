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

/**
 * What a token may be exchanged for (DD6-R02). WEBVIEW_BRIDGE: web login → app WebView session.
 * WEB_HANDOFF: app → signed-in system browser. Purposes never cross: a token minted for one door
 * is refused at the other, so neither flow can be repurposed as a primitive for the other.
 */
export type NativeAuthPurpose = "WEBVIEW_BRIDGE" | "WEB_HANDOFF";

export type NativeAuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationIds: string[];
};

export async function createNativeAuthToken(
  userId: string,
  options: { purpose?: NativeAuthPurpose; destination?: string | null; mobileSessionFamilyId?: string | null } = {}
): Promise<string> {
  const token = randomBytes(32).toString("hex");

  // The stamp in force right now travels with the token (FD1-R01). If it moves before the token is
  // exchanged — password reset, MFA change, block, role change — the exchange refuses.
  const owner = await getPrisma().user.findUnique({ where: { id: userId }, select: { securityStampAt: true } });
  if (!owner) throw new Error("Cannot mint a native auth token for an unknown user.");

  await getPrisma().nativeAuthToken.create({
    data: {
      userId,
      token,
      purpose: options.purpose ?? "WEBVIEW_BRIDGE",
      destination: options.destination ?? null,
      mobileSessionFamilyId: options.mobileSessionFamilyId ?? null,
      securityStampAt: owner.securityStampAt,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS)
    }
  });

  return token;
}

/**
 * Inspect a WEB_HANDOFF token WITHOUT consuming it — for the confirmation interstitial, which must
 * be a pure read (no state change on GET; a prefetch or link scanner must burn nothing).
 */
export async function peekWebHandoffToken(token: string): Promise<{
  email: string;
  destination: string;
  mobileSessionFamilyId: string | null;
} | null> {
  if (!token || token.length < 32) return null;
  const row = await getPrisma().nativeAuthToken.findUnique({
    where: { token },
    include: { user: { select: { email: true, securityStampAt: true, blockedAt: true } } }
  });
  if (!row || row.purpose !== "WEB_HANDOFF" || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  // Same conditions the exchange enforces, so the interstitial is never shown for a token that
  // cannot be spent. This is a courtesy check only — consumeNativeAuthToken() is the gate.
  if (!(await handoffCredentialIsLive(row))) return null;
  return {
    email: row.user.email,
    destination: row.destination ?? "/account",
    mobileSessionFamilyId: row.mobileSessionFamilyId ?? null
  };
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

/**
 * Exchange a single-use token for its user — the ONE authoritative gate for both auth doors.
 *
 * Validation and claim are a single server-side operation (FD1-R01): the UPDATE carries the token,
 * purpose, unspent, and unexpired predicates, so there is no window in which two callers both pass
 * a read and both proceed. The claim is deliberately made BEFORE the remaining checks and is not
 * rolled back when they fail: a token presented under revoked credentials is burnt, not left
 * spendable for a second attempt.
 */
export async function consumeNativeAuthToken(token: string, purpose: NativeAuthPurpose = "WEBVIEW_BRIDGE"): Promise<NativeAuthUser | null> {
  if (!token || token.length < 32) return null;

  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.nativeAuthToken.updateMany({
      where: { token, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });
    if (claimed.count !== 1) return null;

    const row = await tx.nativeAuthToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            organizations: { select: { organizationId: true } }
          }
        }
      }
    });
    if (!row) return null;

    const user = row.user;

    // A blocked account cannot be signed into by any door.
    if (user.blockedAt) return null;

    // The stamp must not have moved since the token was minted. NULL means the token predates this
    // column or was minted by code that failed to record it — refused either way, never trusted.
    if (!row.securityStampAt || row.securityStampAt.getTime() !== user.securityStampAt.getTime()) {
      return null;
    }

    // A browser handoff additionally requires the minting device to still be a live, current
    // session OWNED BY THIS USER — checked inside the same transaction as the claim, so a device
    // revoked concurrently cannot slip through a check/consume window.
    if (purpose === "WEB_HANDOFF") {
      if (!row.mobileSessionFamilyId) return null;
      const device = await tx.mobileSession.findFirst({
        where: {
          familyId: row.mobileSessionFamilyId,
          userId: row.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          securityStamp: user.securityStampAt
        },
        select: { id: true }
      });
      if (!device) return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role as UserRole,
      organizationIds: user.organizations.map((member) => member.organizationId)
    };
  });
}

/**
 * Read-only mirror of the exchange conditions for the confirmation interstitial. Returns false when
 * the credential is already dead (stamp moved, account blocked, device revoked or expired).
 */
async function handoffCredentialIsLive(row: {
  userId: string;
  mobileSessionFamilyId: string | null;
  securityStampAt: Date | null;
  user: { securityStampAt: Date; blockedAt: Date | null };
}): Promise<boolean> {
  if (row.user.blockedAt) return false;
  if (!row.securityStampAt || row.securityStampAt.getTime() !== row.user.securityStampAt.getTime()) return false;
  if (!row.mobileSessionFamilyId) return false;
  const device = await getPrisma().mobileSession.findFirst({
    where: {
      familyId: row.mobileSessionFamilyId,
      userId: row.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      securityStamp: row.user.securityStampAt
    },
    select: { id: true }
  });
  return Boolean(device);
}
