import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse } from "@/lib/coach/http";
import { deleteNutritionEntry } from "@/lib/coach/nutrition";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });
  const { id } = await params;
  try {
    await deleteNutritionEntry(session.user.id, id);
    return NextResponse.json({ data: { id } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
