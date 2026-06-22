"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { activateCoachSubscription, deactivateCoachSubscription } from "@/lib/coach-admin";

export async function activateCoachSubscriptionAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = getFormString(formData, "userId");
  const plan = getFormString(formData, "plan");

  if (plan !== "MONTHLY" && plan !== "YEARLY" && plan !== "CUSTOM") {
    throw new Error("Invalid subscription plan.");
  }

  const months = Number(formData.get("months"));
  const amountRaw = String(formData.get("amountDa") ?? "").trim();
  const noteRaw = String(formData.get("note") ?? "").trim();

  await activateCoachSubscription({
    actorId: session.user.id,
    userId,
    plan,
    months,
    amountDa: amountRaw ? Number(amountRaw) : null,
    note: noteRaw || null
  });

  revalidatePath("/admin/coach");
}

export async function deactivateCoachSubscriptionAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = getFormString(formData, "userId");

  await deactivateCoachSubscription({ actorId: session.user.id, userId });

  revalidatePath("/admin/coach");
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}
