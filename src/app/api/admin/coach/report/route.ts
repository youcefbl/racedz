import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCoachOpsReport } from "@/lib/coach/report";

// GET /api/admin/coach/report?days=30
// Admin-only observability over the coaching loop: run logging, run→workout match performance,
// workout outcomes, current plan adherence, and AI usage + cost. Content-free (counts and rates only).
export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  const requested = Number.parseInt(new URL(request.url).searchParams.get("days") ?? "30", 10);
  const days = Number.isFinite(requested) ? requested : 30;

  try {
    const report = await getCoachOpsReport(days);
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("Coach ops report failed", error);
    return NextResponse.json({ error: "Failed to build the coach report." }, { status: 500 });
  }
}
