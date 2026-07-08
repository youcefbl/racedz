"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { CoachError } from "@/lib/coach/errors";
import {
  cancelOwnCoachSubscription,
  submitCoachSubscriptionRequest,
  withdrawCoachSubscriptionRequest
} from "@/lib/coach/subscription";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export type SubscribeState = { error?: string; success?: boolean };

/** Runner submits a subscription request with uploaded payment proof → awaits admin approval. */
export async function submitCoachSubscriptionAction(
  _previous: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Login is required." };

  // A submit can trigger an admin notification, so bound how often one account can churn the queue.
  if (!checkRateLimit(rateLimitKey("coach-subscribe", session.user.id), 6, 60_000).ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

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

/** Runner withdraws their own pending payment request (wrong plan/screenshot). */
export async function withdrawCoachSubscriptionAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await withdrawCoachSubscriptionRequest(session.user.id);
  revalidatePath("/account/coach/subscribe");
}

/** Runner cancels their own active coach subscription. */
export async function cancelCoachSubscriptionAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await cancelOwnCoachSubscription(session.user.id);
  revalidatePath("/account/coach/subscribe");
}
