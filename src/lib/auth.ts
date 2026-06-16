import { auth } from "@/auth";
import type { UserRole } from "@/types/race";

export type AppSessionUser = {
  id: string;
  email: string;
  role: UserRole;
  organizationIds: string[];
};

export async function getCurrentUser(): Promise<AppSessionUser | null> {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    organizationIds: session.user.organizationIds
  };
}
