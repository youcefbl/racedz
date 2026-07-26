"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditLog, requireAdmin } from "@/lib/admin";
import { clearAllClientErrors, deleteClientError } from "@/lib/client-errors";

export async function deleteClientErrorAction(formData: FormData) {
  const session = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) throw new Error("Missing error id");

  await deleteClientError(id);
  await recordAdminAuditLog({
    actorId: session.user.id,
    action: "client_error.deleted",
    targetType: "ClientErrorLog",
    targetId: id,
    summary: "Dismissed a client error report"
  });
  revalidatePath("/admin/errors");
}

export async function clearAllClientErrorsAction() {
  const session = await requireAdmin();
  await clearAllClientErrors();
  await recordAdminAuditLog({
    actorId: session.user.id,
    action: "client_error.cleared_all",
    targetType: "ClientErrorLog",
    targetId: "all",
    summary: "Cleared all client error reports"
  });
  revalidatePath("/admin/errors");
}
