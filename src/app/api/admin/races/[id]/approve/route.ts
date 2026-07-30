import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { revalidateRacesCache } from "@/lib/race-repository";
import { AdminError, requireImportedRaceReview } from "@/lib/admin";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

type AdminRaceActionContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: AdminRaceActionContext) {
  const session = await auth();
  const { id } = await context.params;

  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  const limited = enforceRateLimit(rateLimitKey("admin-mutate", session.user.id), 30, 5 * 60_000);
  if (limited) return limited;

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
