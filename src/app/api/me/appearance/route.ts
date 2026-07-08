import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns the signed-in runner's saved language/theme so a fresh device can adopt them.
// Public callers get nulls (no error) — the client sync just does nothing in that case.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: { language: null, theme: null } });
  }
  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { language: true, theme: true }
  });
  return NextResponse.json({ data: { language: user?.language ?? null, theme: user?.theme ?? null } });
}
