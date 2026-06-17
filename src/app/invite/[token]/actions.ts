"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptOrganizationInvitation, OrganizerError } from "@/lib/organizer";

export type AcceptInviteActionState = {
  error?: string;
};

export async function acceptInviteAction(
  _previousState: AcceptInviteActionState,
  formData: FormData
): Promise<AcceptInviteActionState> {
  const token = getString(formData, "token");
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }

  try {
    await acceptOrganizationInvitation({
      token,
      userId: session.user.id
    });
  } catch (error) {
    if (error instanceof OrganizerError) {
      return { error: error.message };
    }

    throw error;
  }

  redirect("/organizer");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}
