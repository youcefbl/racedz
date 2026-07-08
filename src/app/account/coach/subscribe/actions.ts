"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { CoachError } from "@/lib/coach/errors";
import { submitCoachSubscriptionRequest } from "@/lib/coach/subscription";

export type SubscribeState = { error?: string; success?: boolean };

/** Runner submits a subscription request with uploaded payment proof → awaits admin approval. */
export async function submitCoachSubscriptionAction(
  _previous: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Login is required." };

  try {
    await submitCoachSubscriptionRequest(session.user.id, {
      plan: formData.get("plan"),
      paymentMethod: formData.get("paymentMethod"),
      paymentProofUrl: formData.get("paymentProofUrl")
    });
  } catch (error) {
    if (error instanceof CoachError) return { error: error.message };
    return { error: "Could not submit your request. Please try again." };
  }

  revalidatePath("/account/coach/subscribe");
  return { success: true };
}
