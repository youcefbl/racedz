"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { recordAdminAuditLog } from "@/lib/admin";
import { resolveReport } from "@/lib/reports";

export async function dismissReportAction(formData: FormData) {
  const session = await requireAdmin();
  const reportId = getFormId(formData);
  const note = getOptionalFormString(formData, "note");

  await resolveReport({ reportId, adminId: session.user.id, status: "DISMISSED", note });
  await recordAdminAuditLog({
    actorId: session.user.id,
    action: "report.dismissed",
    targetType: "Report",
    targetId: reportId,
    summary: "Dismissed report",
    metadata: note ? { note } : undefined
  });
  revalidatePath("/admin/reports");
}

export async function resolveReportAction(formData: FormData) {
  const session = await requireAdmin();
  const reportId = getFormId(formData);
  const note = getOptionalFormString(formData, "note");

  await resolveReport({ reportId, adminId: session.user.id, status: "ACTIONED", note });
  await recordAdminAuditLog({
    actorId: session.user.id,
    action: "report.actioned",
    targetType: "Report",
    targetId: reportId,
    summary: "Actioned report",
    metadata: note ? { note } : undefined
  });
  revalidatePath("/admin/reports");
}

function getFormId(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing report id");
  }
  return id;
}

function getOptionalFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
