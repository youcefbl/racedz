import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { decideRegistrationProofAccess } from "@/lib/registrations";
import { resolvePaymentProofPath } from "@/lib/storage";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

// Serve a race-registration payment-proof image (financial PII) only to the runner who submitted
// it, an admin, or an organizer member of the race's own organization. The public /uploads/payment/*
// path is 403'd by Caddy (see Caddyfile), so this route is the only way to read a proof.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const limited = enforceRateLimit(rateLimitKey("registration-payment-proof", session.user.id), 60, 5 * 60_000);
  if (limited) return limited;

  const { id } = await context.params;
  const decision = await decideRegistrationProofAccess({
    registrationId: id,
    viewerId: session.user.id,
    viewerRole: session.user.role
  });

  if (!decision.allowed) {
    // Only an actual refusal is logged. "No such proof" is not an authorization event, and logging
    // it would bury the real ones under every stale link and mistyped id.
    if (decision.reason === "forbidden") {
      logSecurityEvent("private_file_denied", { userId: session.user.id, registrationId: id, resource: "registration-payment-proof" });
    }
    // Both answer 404: telling an unauthorized caller that the proof exists is itself a disclosure.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filePath = resolvePaymentProofPath(decision.proofUrl);
  if (!filePath) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const file = await readFile(filePath);
    const extension = filePath.split(".").pop() ?? "";
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
