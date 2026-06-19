"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { markNotificationRead } from "@/lib/notifications";

export async function markNotificationReadAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/notifications");
  }

  const notificationId = formData.get("notificationId");

  if (typeof notificationId !== "string" || notificationId.length === 0) {
    throw new Error("Missing notification id.");
  }

  await markNotificationRead(session.user.id, notificationId);
  revalidatePath("/account/notifications");
}
