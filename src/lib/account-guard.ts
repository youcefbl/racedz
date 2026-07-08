import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";

/**
 * Enforce a live block on an already-signed-in user. A JWT session minted before the block
 * stays valid on its own, so protected areas call this on the server to re-check the DB and
 * bounce blocked accounts to /blocked (which then signs them out). No-op when logged out —
 * page-level auth() checks handle the unauthenticated case.
 */
export async function assertNotBlocked() {
  const session = await auth();
  if (!session?.user?.id) return;

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { blockedAt: true }
  });

  if (user?.blockedAt) {
    redirect("/blocked");
  }
}
