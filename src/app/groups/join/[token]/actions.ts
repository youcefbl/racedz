"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GroupError, joinGroupByToken } from "@/lib/groups";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export type JoinGroupActionState = { error?: string };

export async function joinGroupAction(_prev: JoinGroupActionState, formData: FormData): Promise<JoinGroupActionState> {
  const token = String(formData.get("token") ?? "");
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/groups/join/${token}`);
  }

  // Throttle token-guessing/spam-joining, keyed by the authenticated user (unspoofable).
  const rate = checkRateLimit(rateLimitKey("group-join", session.user.id), 20, 10 * 60 * 1000);
  if (!rate.ok) return { error: "Too many attempts. Please try again in a few minutes." };

  let groupId: string;
  try {
    ({ groupId } = await joinGroupByToken(session.user.id, token));
  } catch (error) {
    if (error instanceof GroupError) return { error: error.message };
    throw error;
  }

  redirect(`/account/groups/${groupId}`);
}
