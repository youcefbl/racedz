"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { activateCoachSubscription, deactivateCoachSubscription } from "@/lib/coach-admin";
import { resolvePlanCharge, STUDENT_PROMO } from "@/lib/coach/plans";

export async function activateCoachSubscriptionAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = getFormString(formData, "userId");
  const plan = getFormString(formData, "plan");

  if (plan !== "MONTHLY" && plan !== "YEARLY" && plan !== "CUSTOM") {
    throw new Error("Invalid subscription plan.");
  }

  const student = String(formData.get("student") ?? "") === "on";
  const amountRaw = String(formData.get("amountDa") ?? "").trim();
  const noteRaw = String(formData.get("note") ?? "").trim();

  // MONTHLY/YEARLY derive months + price from the shared config (with the optional student
  // discount); CUSTOM keeps the admin's typed months. An explicit amount always overrides.
  const charge = resolvePlanCharge(plan, {
    student,
    monthsOverride: Number(formData.get("months")),
    amountOverride: amountRaw ? Number(amountRaw) : null
  });

  await activateCoachSubscription({
    actorId: session.user.id,
    userId,
    plan,
    months: charge.months,
    amountDa: amountRaw ? Number(amountRaw) : charge.amountDa,
    note: noteRaw || (student ? STUDENT_PROMO.code : null)
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
