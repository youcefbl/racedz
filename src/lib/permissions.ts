import type { UserRole } from "@/types/race";

const roleRank: Record<UserRole, number> = {
  RUNNER: 1,
  ORGANIZER: 2,
  ADMIN: 3,
  SUPERADMIN: 4
};

export function hasRole(userRole: UserRole | undefined, requiredRole: UserRole) {
  if (!userRole) {
    return false;
  }

  return roleRank[userRole] >= roleRank[requiredRole];
}

export function canManageRace(userRole: UserRole | undefined, ownerOrganizationId?: string, userOrganizationIds: string[] = []) {
  if (userRole === "ADMIN" || userRole === "SUPERADMIN") {
    return true;
  }

  if (userRole !== "ORGANIZER" || !ownerOrganizationId) {
    return false;
  }

  return userOrganizationIds.includes(ownerOrganizationId);
}
