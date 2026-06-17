"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function approveOrganizationAction(formData: FormData) {
  await requireAdmin();
  const organizationId = getFormId(formData);
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: {
        id: organizationId
      },
      data: {
        status: "APPROVED"
      }
    });

    await tx.$executeRaw`
      UPDATE "Organization"
      SET "rejectionReason" = NULL
      WHERE "id" = ${organizationId}
    `;

    const members = await tx.organizationMember.findMany({
      where: {
        organizationId
      },
      select: {
        userId: true
      }
    });

    await tx.user.updateMany({
      where: {
        id: {
          in: members.map((member) => member.userId)
        },
        role: "RUNNER"
      },
      data: {
        role: "ORGANIZER"
      }
    });
  });

  revalidateAdmin();
}

export async function rejectOrganizationAction(formData: FormData) {
  await requireAdmin();
  const organizationId = getFormId(formData);
  const reason = getOptionalFormString(formData, "reason");

  await getPrisma().$executeRaw`
    UPDATE "Organization"
    SET
      "status" = 'REJECTED'::"OrganizationStatus",
      "rejectionReason" = ${reason ?? null},
      "updatedAt" = NOW()
    WHERE "id" = ${organizationId}
  `;

  revalidateAdmin();
}

export async function approveRaceAction(formData: FormData) {
  await requireAdmin();
  const raceId = getFormId(formData);

  await getPrisma().raceEvent.update({
    where: {
      id: raceId
    },
    data: {
      status: "PUBLISHED"
    }
  });

  revalidateAdmin();
  revalidatePath("/races");
}

export async function rejectRaceAction(formData: FormData) {
  await requireAdmin();
  const raceId = getFormId(formData);

  await getPrisma().raceEvent.update({
    where: {
      id: raceId
    },
    data: {
      status: "REJECTED"
    }
  });

  revalidateAdmin();
}

export async function unpublishRaceAction(formData: FormData) {
  await requireAdmin();
  const raceId = getFormId(formData);

  await getPrisma().raceEvent.update({
    where: {
      id: raceId
    },
    data: {
      status: "DRAFT",
      registrationStatus: "CLOSED"
    }
  });

  revalidateAdmin();
  revalidatePath("/races");
}

export async function updateUserRoleAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = getFormId(formData);
  const role = getFormString(formData, "role");

  if (role !== "RUNNER" && role !== "ORGANIZER" && role !== "ADMIN" && role !== "SUPERADMIN") {
    throw new Error("Invalid user role");
  }

  if (session.user.id === userId) {
    throw new Error("Admins cannot change their own role.");
  }

  const prisma = getPrisma();
  const target = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      role: true
    }
  });

  if (!target) {
    throw new Error("User not found");
  }

  if ((target.role === "SUPERADMIN" || role === "SUPERADMIN") && session.user.role !== "SUPERADMIN") {
    throw new Error("Only superadmins can manage superadmin access.");
  }

  if (target.role === "SUPERADMIN" && role !== "SUPERADMIN") {
    const superadminCount = await prisma.user.count({
      where: {
        role: "SUPERADMIN"
      }
    });

    if (superadminCount <= 1) {
      throw new Error("The platform must keep at least one superadmin.");
    }
  }

  await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      role
    }
  });

  revalidateAdmin();
}

function getFormId(formData: FormData) {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing action id");
  }

  return id;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing ${key}`);
  }

  return value;
}

function getOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/races");
  revalidatePath("/admin/users");
  revalidatePath("/admin/registrations");
}
