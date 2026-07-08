import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getUserSupportView, normalizeSupportBody, postUserSupportMessage } from "@/lib/support";

export const dynamic = "force-dynamic";

// Poll target for the runner's support chat. Viewing marks admin replies as read.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });
  const data = await getUserSupportView(session.user.id);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  // Per-user burst cap: keeps the thread from being flooded and bounds admin-notification fan-out.
  const limited = enforceRateLimit(rateLimitKey("support-message", session.user.id), 15, 60_000);
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = normalizeSupportBody((payload as { body?: unknown })?.body);
  if (!body) return NextResponse.json({ error: "Message is empty or too long." }, { status: 400 });

  const data = await postUserSupportMessage(session.user.id, body);
  return NextResponse.json({ data }, { status: 201 });
}
