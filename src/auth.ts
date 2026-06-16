import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations";
import type { UserRole } from "@/types/race";

type DatabaseUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  role: UserRole;
  organizations?: Array<{
    organizationId: string;
  }>;
};

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

        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          organizationIds: user.organizations?.map((member) => member.organizationId) ?? []
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organizationIds = user.organizationIds;
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
