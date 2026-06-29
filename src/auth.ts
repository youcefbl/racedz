import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { isEmailVerified } from "@/lib/email-verification";
import { consumeNativeAuthToken } from "@/lib/native-auth";
import { loginSchema } from "@/lib/validations";
import type { UserRole } from "@/types/race";

type DatabaseUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  role: UserRole;
  blockedAt?: Date | null;
  firstLoginAt?: Date | null;
  organizations?: Array<{
    organizationId: string;
  }>;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationIds: string[];
};

const googleProviderEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const prisma = getPrisma();
        const user = (await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: {
            organizations: {
              select: {
                organizationId: true
              }
            }
          }
        })) as DatabaseUser | null;

        if (!user?.passwordHash) {
          return null;
        }

        // Blocked accounts cannot sign in.
        if (user.blockedAt) {
          return null;
        }

        if (!(await isEmailVerified(user.email))) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        const now = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: now, firstLoginAt: user.firstLoginAt ?? now }
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          organizationIds: user.organizations?.map((member) => member.organizationId) ?? []
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
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const email = getOAuthEmail(profile);
        if (!email || !getGoogleEmailVerified(profile)) {
          return false;
        }
        // Blocked accounts cannot sign in via Google either.
        const existing = await getPrisma().user.findUnique({ where: { email }, select: { blockedAt: true } });
        return !existing?.blockedAt;
      }

      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        const authUser = await getOrCreateGoogleUser({ profile, name: user?.name });

        token.sub = authUser.id;
        token.email = authUser.email;
        token.name = authUser.name;
        token.role = authUser.role;
        token.organizationIds = authUser.organizationIds;

        return token;
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
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as UserRole;
        session.user.organizationIds = Array.isArray(token.organizationIds)
          ? (token.organizationIds as string[])
          : [];
      }

      return session;
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
    const updateData: { emailVerifiedAt?: Date; avatarUrl?: string; lastLoginAt: Date; firstLoginAt?: Date } = {
      lastLoginAt: now,
      firstLoginAt: existing.firstLoginAt ?? now
    };

    if (!existing.emailVerifiedAt) {
      updateData.emailVerifiedAt = now;
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
