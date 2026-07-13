import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { RunRoutePoint } from "@/components/coach/types";
import { buildGpx } from "@/lib/coach/gpx";
import { getRunnerRunForExport } from "@/lib/coach/service";

// Export one of the caller's runs as a downloadable .gpx file (data portability).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const { id } = await params;
  const run = await getRunnerRunForExport(session.user.id, id);
  if (!run) return NextResponse.json({ error: "Run was not found." }, { status: 404 });

  const route = Array.isArray(run.route) ? (run.route as unknown as RunRoutePoint[]) : [];
  if (route.length === 0) {
    return NextResponse.json({ error: "This run has no GPS track to export." }, { status: 422 });
  }

  const gpx = buildGpx({ name: run.title, startedAt: run.startedAt, route });
  const filename = `zidrun-${new Date(run.startedAt).toISOString().slice(0, 10)}-${run.id.slice(0, 6)}.gpx`;

  return new NextResponse(gpx, {
    status: 200,
    headers: {
      "content-type": "application/gpx+xml; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
