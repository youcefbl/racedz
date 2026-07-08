import { readFile } from "fs/promises";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { resolveCoachPaymentProofPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

// Serve a coach-payment proof image (financial PII) only to the runner who uploaded it or to an
// admin. The public /uploads/coach-payment/* path is 403'd by Caddy, so this route is the only way
// to read a proof — authorization is enforced by matching the request row's owner.
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login is required." }, { status: 401 });

  const { path: segments } = await context.params;
  const proofUrl = `/api/coach/subscription/proof/${(segments ?? []).join("/")}`;
  const filePath = resolveCoachPaymentProofPath(proofUrl);
  if (!filePath) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPERADMIN";
  const ownershipFilter = isAdmin ? Prisma.empty : Prisma.sql`AND "userId" = ${session.user.id}`;
  const rows = await getPrisma().$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CoachSubscriptionRequest"
    WHERE "paymentProofUrl" = ${proofUrl} ${ownershipFilter}
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "Not found." }, { status: 404 });

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
