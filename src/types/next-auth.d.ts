import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types/race";

declare module "next-auth" {
  interface User {
    role: UserRole;
    organizationIds: string[];
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
  }
}
