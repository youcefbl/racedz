import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";

type AdminOrganizationActionContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: AdminOrganizationActionContext) {
  const session = await auth();
  const { id } = await context.params;

  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  const prisma = getPrisma();
  const organization = await prisma.$transaction(async (tx) => {
    const updatedOrganization = await tx.organization.update({
      where: {
        id
      },
      data: {
        status: "APPROVED"
      }
    });

    const members = await tx.organizationMember.findMany({
      where: {
        organizationId: id
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

    return updatedOrganization;
  });

  return NextResponse.json({
    data: organization
  });
}
