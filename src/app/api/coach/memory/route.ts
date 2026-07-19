import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { coachErrorResponse, readCoachJson } from "@/lib/coach/http";
import { confirmMemory, deleteAllMemory, dismissMemory, exportMemory } from "@/lib/coach/memory-store";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

// Runner data controls for long-term coaching memory (Phase 3): inspect and export what the coach
// remembers, correct it, and delete it. Every operation is scoped to the authenticated user inside
// the query itself, so a guessed memory id from another account matches nothing.

/** Inspect / export everything remembered about this runner, including superseded and dismissed rows. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  try {
    const memories = await exportMemory(session.user.id);
    return NextResponse.json({ data: memories, meta: { count: memories.length } });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

/** Correct memory: dismiss a fact that is wrong, or confirm one that is still true. */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("coach-memory-patch", session.user.id), 60, 60_000);
  if (limited) return limited;

  try {
    const body = (await readCoachJson(request)) as { id?: unknown; action?: unknown };
    const id = typeof body.id === "string" ? body.id : null;
    const action = body.action === "dismiss" || body.action === "confirm" ? body.action : null;
    if (!id || !action) {
      return NextResponse.json({ error: "An id and an action of 'dismiss' or 'confirm' are required." }, { status: 400 });
    }

    const result = action === "dismiss" ? await dismissMemory(session.user.id, id) : await confirmMemory(session.user.id, id);
    const changed = "dismissed" in result ? result.dismissed : result.confirmed;
    if (!changed) return NextResponse.json({ error: "That memory was not found." }, { status: 404 });
    return NextResponse.json({ data: result });
  } catch (error) {
    return coachErrorResponse(error);
  }
}

/** Erase all coaching memory for this runner. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("coach-memory-delete", session.user.id), 5, 60_000);
  if (limited) return limited;

  try {
    const result = await deleteAllMemory(session.user.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return coachErrorResponse(error);
  }
}
