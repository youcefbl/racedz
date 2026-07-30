import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types/race";

declare module "next-auth" {
  interface User {
    role?: UserRole;
    organizationIds?: string[];
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      organizationIds: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    organizationIds: string[];
    /** Epoch ms of the user's securityStampAt as of the last freshness check (see src/auth.ts). */
    securityStamp?: number;
    /** Set when securityStampAt has advanced past this token's stamp (password reset, MFA change,
     *  block, role change) — session() treats a revoked token as logged out. */
    revoked?: boolean;
  }
}
