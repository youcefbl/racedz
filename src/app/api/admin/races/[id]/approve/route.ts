import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";

type AdminRaceActionContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: AdminRaceActionContext) {
  const session = await auth();
  const { id } = await context.params;

  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  const race = await getPrisma().raceEvent.update({
    where: {
      id
    },
    data: {
      status: "PUBLISHED"
    }
  });

  return NextResponse.json({
    data: race
  });
}
