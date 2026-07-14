import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { getPrisma } from "@/lib/db";
import { verifyLoginCredentials, verifyMfaCode } from "@/lib/auth-credentials";
import { createMfaTicket } from "@/lib/mfa-ticket";
import { consumeNativeAuthToken } from "@/lib/native-auth";
import { loginSchema } from "@/lib/validations";
import type { UserRole } from "@/types/race";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationIds: string[];
};

const googleProviderEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Edge-safe base (session strategy, pages, trustHost, session callback) is shared
  // with the middleware via src/auth.config.ts.
  ...authConfig,
  // Surface the real cause of auth failures in the server logs. Without this, a
  // thrown callback/OAuth error only shows users the generic
  // /api/auth/error?error=Configuration page with no detail. Grep logs for "[auth]".
  logger: {
    error(error: Error) {
      console.error("[auth][error]", error);
    }
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator code", type: "text" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await verifyLoginCredentials(parsed.data.email, parsed.data.password);

        if (!user) {
          return null;
        }

        // Second factor: when the account has MFA enabled, a valid TOTP or recovery code is
        // required here — this gate is authoritative and cannot be skipped by calling the
        // credentials endpoint directly (the login action's two-step prompt is only the UX).
        if (user.mfaEnabled) {
          const totp = typeof credentials?.totp === "string" ? credentials.totp : "";
          if (!(await verifyMfaCode(user, totp))) {
            return null;
          }
        }

        const now = new Date();
        await getPrisma().user.update({
          where: { id: user.id },
          data: { lastLoginAt: now, firstLoginAt: user.firstLoginAt ?? now }
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          organizationIds: user.organizationIds
        };
      }
    }),
    // Native bridge: the app's WebView exchanges a one-time token (minted after a
    // system-browser Google sign-in) for a real session. See src/lib/native-auth.ts.
    Credentials({
      id: "native-bridge",
      name: "Native bridge",
      credentials: {
        token: { label: "Token", type: "text" }
      },
      async authorize(credentials) {
        const token = typeof credentials?.token === "string" ? credentials.token : null;

        if (!token) {
          return null;
        }

        return consumeNativeAuthToken(token);
      }
    }),
    ...(googleProviderEnabled
      ? [
          Google({
            // Always show Google's "choose an account" picker instead of a full login,
            // so users already signed into Google can pick their account in one tap.
            authorization: { params: { prompt: "select_account" } }
          })
        ]
      : [])
  ],
  callbacks: {
    // session() is defined in src/auth.config.ts (edge-safe, shared with middleware).
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const email = getOAuthEmail(profile);
        if (!email || !getGoogleEmailVerified(profile)) {
          return false;
        }
        try {
          const existing = await getPrisma().user.findUnique({
            where: { email },
            select: { id: true, blockedAt: true, mfaEnabled: true }
          });
          // Blocked accounts cannot sign in via Google either.
          if (existing?.blockedAt) return false;
          // Second factor: Google verifies identity but is only the FIRST factor. If this account has
          // MFA on, deny the session here and redirect to the dedicated code page — returning a string
          // from signIn() redirects without establishing a session (see @auth/core handleAuthorized).
          // A valid code there mints the real session via the single-use native-auth bridge.
          if (existing?.mfaEnabled) {
            const ticket = createMfaTicket({ uid: existing.id, ff: true });
            return `/login/mfa?t=${encodeURIComponent(ticket)}`;
          }
          return true;
        } catch (error) {
          console.error("[auth][google] signIn callback DB lookup failed:", error);
          throw error;
        }
      }

      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        try {
          const authUser = await getOrCreateGoogleUser({ profile, name: user?.name });

          token.sub = authUser.id;
          token.email = authUser.email;
          token.name = authUser.name;
          token.role = authUser.role;
          token.organizationIds = authUser.organizationIds;

          return token;
        } catch (error) {
          console.error("[auth][google] jwt callback failed to resolve user:", error);
          throw error;
        }
      }

      if (user) {
        token.role = user.role;
        token.organizationIds = user.organizationIds;
      }

      if (!token.role && token.email) {
        const authUser = await getAuthUserByEmail(token.email);

        if (authUser) {
          token.sub = authUser.id;
          token.email = authUser.email;
          token.name = authUser.name;
          token.role = authUser.role;
          token.organizationIds = authUser.organizationIds;
        }
      }

      return token;
    }
  }
});

async function getOrCreateGoogleUser({
  profile,
  name
}: {
  profile: unknown;
  name?: string | null;
}): Promise<AuthUser> {
  const email = getOAuthEmail(profile);

  if (!email) {
    throw new Error("Google did not return an email address.");
  }

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: {
      email
    },
    include: {
      organizations: {
        select: {
          organizationId: true
        }
      }
    }
  });

  if (existing) {
    const picture = getOAuthPicture(profile);
    const now = new Date();
    // Track sign-in activity (lastLoginAt always, firstLoginAt on the first one).
    const updateData: {
      emailVerifiedAt?: Date;
      avatarUrl?: string;
      lastLoginAt: Date;
      firstLoginAt?: Date;
      passwordHash?: null;
    } = {
      lastLoginAt: now,
      firstLoginAt: existing.firstLoginAt ?? now
    };

    if (!existing.emailVerifiedAt) {
      updateData.emailVerifiedAt = now;

      // Account-takeover guard: linking Google verifies this email for the first time. If the
      // account also carries a credentials passwordHash that was set while unverified, an attacker
      // could have pre-registered it — clear the password so the real owner must reset it before
      // any credentials login works again. (No-op when there was never a password.)
      if (existing.passwordHash) {
        updateData.passwordHash = null;
      }
    }

    if (!existing.avatarUrl && picture) {
      updateData.avatarUrl = picture;
    }

    const user = await prisma.user.update({
      where: {
        id: existing.id
      },
      data: updateData,
      include: {
        organizations: {
          select: {
            organizationId: true
          }
        }
      }
    });

    return mapDatabaseUserToAuthUser(user);
  }

  const names = getOAuthNames(profile, name ?? email);
  const now = new Date();
  const created = await prisma.user.create({
    data: {
      email,
      firstName: names.firstName,
      lastName: names.lastName,
      avatarUrl: getOAuthPicture(profile),
      emailVerifiedAt: now,
      firstLoginAt: now,
      lastLoginAt: now,
      role: "RUNNER"
    },
    include: {
      organizations: {
        select: {
          organizationId: true
        }
      }
    }
  });

  return mapDatabaseUserToAuthUser(created);
}

async function getAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await getPrisma().user.findUnique({
    where: {
      email: email.toLowerCase()
    },
    include: {
      organizations: {
        select: {
          organizationId: true
        }
      }
    }
  });

  return user ? mapDatabaseUserToAuthUser(user) : null;
}

function mapDatabaseUserToAuthUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizations?: Array<{ organizationId: string }>;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    role: user.role,
    organizationIds: user.organizations?.map((member) => member.organizationId) ?? []
  };
}

function getOAuthEmail(profile: unknown) {
  if (!isRecord(profile) || typeof profile.email !== "string") {
    return null;
  }

  return profile.email.toLowerCase();
}

function getGoogleEmailVerified(profile: unknown) {
  return isRecord(profile) && profile.email_verified === true;
}

function getOAuthPicture(profile: unknown) {
  return isRecord(profile) && typeof profile.picture === "string" ? profile.picture : undefined;
}

function getOAuthNames(profile: unknown, fallbackName: string) {
  if (isRecord(profile)) {
    const firstName = typeof profile.given_name === "string" ? profile.given_name.trim() : "";
    const lastName = typeof profile.family_name === "string" ? profile.family_name.trim() : "";

    if (firstName && lastName) {
      return { firstName, lastName };
    }
  }

  const parts = fallbackName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "ZidRun",
    lastName: parts.slice(1).join(" ") || "Runner"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
