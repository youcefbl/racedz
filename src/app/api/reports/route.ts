import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createReport, ReportError, reportInputSchema } from "@/lib/reports";

// User-facing report submission. Login required; rate-limited per user.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required to report content.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const limited = enforceRateLimit(rateLimitKey("report", session.user.id), 5, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const input = reportInputSchema.parse(body);
    const report = await createReport({ reporterId: session.user.id, input });
    return NextResponse.json({ data: { id: report.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Please pick a reason.", code: "VALIDATION_ERROR", fields: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    if (error instanceof ReportError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request.", code: "INVALID_JSON" }, { status: 400 });
    }
    console.error("Unhandled report API error", error);
    return NextResponse.json({ error: "Could not submit report.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
