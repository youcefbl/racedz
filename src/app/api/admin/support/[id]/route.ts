import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getAdminSupportThread, normalizeSupportBody, postAdminSupportMessage } from "@/lib/support";

export const dynamic = "force-dynamic";

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

// Poll target for one admin support thread. Viewing marks runner messages as read.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session?.user?.role)) {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }
  const { id } = await params;
  const data = await getAdminSupportThread(id);
  if (!data) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session?.user?.role) || !session?.user?.id) {
    return NextResponse.json({ error: "Admin access is required" }, { status: 403 });
  }

  const limited = enforceRateLimit(rateLimitKey("support-admin-reply", session.user.id), 30, 60_000);
  if (limited) return limited;

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = normalizeSupportBody((payload as { body?: unknown })?.body);
  if (!body) return NextResponse.json({ error: "Message is empty or too long." }, { status: 400 });

  const data = await postAdminSupportMessage(id, session.user.id, body);
  if (!data) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  return NextResponse.json({ data }, { status: 201 });
}
