import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
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
  const registration = await getPrisma().raceRegistration.findUnique({
    where: { id },
    select: {
      userId: true,
      paymentProofUrl: true,
      raceEvent: { select: { organizationId: true } }
    }
  });
  if (!registration || !registration.paymentProofUrl) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const isOwner = registration.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";
  const isOrganizerForRace =
    !isOwner && registration.raceEvent.organizationId
      ? Boolean(
          await getPrisma().organizationMember.findFirst({
            where: { userId: session.user.id, organizationId: registration.raceEvent.organizationId },
            select: { id: true }
          })
        )
      : false;
  if (!isOwner && !isAdmin && !isOrganizerForRace) {
    logSecurityEvent("private_file_denied", { userId: session.user.id, registrationId: id, resource: "registration-payment-proof" });
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filePath = resolvePaymentProofPath(registration.paymentProofUrl);
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
