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

  const organization = await getPrisma().organization.update({
    where: {
      id
    },
    data: {
      status: "REJECTED"
    }
  });

  return NextResponse.json({
    data: organization
  });
}
