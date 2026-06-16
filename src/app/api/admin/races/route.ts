import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminRaces } from "@/lib/admin";

export async function GET() {
  const session = await auth();

  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  const races = await getAdminRaces({});

  return NextResponse.json({
    data: races,
    meta: {
      count: races.length
    }
  });
}
