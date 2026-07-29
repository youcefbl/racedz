import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { revalidateRacesCache } from "@/lib/race-repository";
import { AdminError, requireImportedRaceReview } from "@/lib/admin";

type AdminRaceActionContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: AdminRaceActionContext) {
  const session = await auth();
  const { id } = await context.params;

  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  try {
    await requireImportedRaceReview(id);
  } catch (error) {
    if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }

  const race = await getPrisma().raceEvent.update({
    where: {
      id
    },
    data: {
      status: "PUBLISHED"
    }
  });

  revalidateRacesCache();

  return NextResponse.json({
    data: race
  });
}
