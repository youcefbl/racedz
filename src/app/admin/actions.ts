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

  await getPrisma().organization.update({
    where: {
      id: organizationId
    },
    data: {
      status: "REJECTED"
    }
  });

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

function getFormId(formData: FormData) {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing action id");
  }

  return id;
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/races");
  revalidatePath("/admin/users");
  revalidatePath("/admin/registrations");
}
