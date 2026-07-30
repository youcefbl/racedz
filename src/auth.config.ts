import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types/race";

// Edge-safe NextAuth config shared by the Node auth instance (src/auth.ts) and the
// edge middleware (src/middleware.ts). This file MUST stay importable from the edge
// runtime: no Prisma, no `server-only`, no bcrypt — nothing that the middleware bundle
// can't run. The DB-touching providers and the signIn/jwt callbacks live in src/auth.ts;
// only the JWT session strategy and the (pure) session mapper belong here, because the
// middleware needs the user's role to enforce the route guard.
export const authConfig = {
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  // Intentionally empty: the middleware instance only decodes the JWT (it never runs
  // authorize()). The real providers are added in src/auth.ts.
  providers: [],
  callbacks: {
    session({ session, token }) {
      // A password reset, MFA change, block, or role change bumps User.securityStampAt; the
      // Node-side jwt() callback (src/auth.ts) marks any session token minted before that moment
      // as revoked the next time it's used. Drop `user` here so every existing `!session?.user`
      // check across the app (middleware, requireUserId()-style helpers) treats it as logged out,
      // with no per-call-site changes needed. This is edge-safe: it only reads the token already
      // decoded from the cookie, no DB access.
      if (token.revoked) {
        return { ...session, user: undefined } as unknown as typeof session;
      }

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
} satisfies NextAuthConfig;

export default authConfig;
