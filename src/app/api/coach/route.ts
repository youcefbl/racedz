import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse } from "@/lib/coach/http";
import { getCoachDashboard } from "@/lib/coach/service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    return NextResponse.json({ data: await getCoachDashboard(session.user.id) });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

