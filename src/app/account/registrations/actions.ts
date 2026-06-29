"use server";

import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@prisma/client";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";

const MANUAL_METHODS: PaymentMethod[] = ["BARIDIMOB", "CCP", "BANK_TRANSFER", "CASH", "OTHER"];
const PROOF_PATH = /^\/uploads\/payment\/[0-9]{4}-[0-9]{2}\/[a-f0-9-]+\.(jpg|png|webp|gif)$/;

export type PaymentProofState = { error?: string; success?: boolean };

/** Runner submits proof of a manual (BaridiMob/CCP/…) payment → registration goes to MANUAL_REVIEW. */
export async function submitPaymentProofAction(
  _previous: PaymentProofState,
  formData: FormData
): Promise<PaymentProofState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Login is required." };
  }

  const id = String(formData.get("registrationId") ?? "");
  const method = String(formData.get("paymentMethod") ?? "") as PaymentMethod;
  const proofUrl = String(formData.get("paymentProofUrl") ?? "");

  if (!MANUAL_METHODS.includes(method)) {
    return { error: "Choose how you paid." };
  }
  if (!PROOF_PATH.test(proofUrl)) {
    return { error: "Upload a clear screenshot of your payment." };
  }

  const prisma = getPrisma();
  const registration = await prisma.raceRegistration.findUnique({
    where: { id },
    select: { userId: true, paymentStatus: true }
  });

  if (!registration || registration.userId !== session.user.id) {
    return { error: "Registration not found." };
  }
  if (registration.paymentStatus === "NOT_REQUIRED" || registration.paymentStatus === "PAID") {
    return { error: "No payment is needed for this registration." };
  }

  await prisma.raceRegistration.update({
    where: { id },
    data: { paymentMethod: method, paymentProofUrl: proofUrl, paymentStatus: "MANUAL_REVIEW" }
  });

  revalidatePath("/account/registrations");
  return { success: true };
}
