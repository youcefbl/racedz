import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse } from "@/lib/coach/http";
import { deleteNutritionEntry } from "@/lib/coach/nutrition";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });
  const limited = enforceRateLimit(rateLimitKey("coach-api", session.user.id), 120, 5 * 60_000);
  if (limited) return limited;
  const { id } = await params;
  try {
    await deleteNutritionEntry(session.user.id, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
