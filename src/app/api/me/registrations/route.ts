import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserRegistrations } from "@/lib/registrations";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  const registrations = await getUserRegistrations(session.user.id);

  return NextResponse.json({
    data: registrations,
    meta: {
      count: registrations.length
    }
  });
}
