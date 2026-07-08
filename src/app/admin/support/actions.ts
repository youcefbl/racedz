"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { setSupportThreadStatus } from "@/lib/support";

// Resolve (CLOSED) or reopen (OPEN) a support thread. Called from the admin thread view.
export async function setSupportThreadStatusAction(threadId: string, status: "OPEN" | "CLOSED") {
  await requireAdmin();
  await setSupportThreadStatus(threadId, status);
  revalidatePath(`/admin/support/${threadId}`);
  revalidatePath("/admin/support");
}
