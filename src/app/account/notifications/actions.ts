"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";

export async function markNotificationReadAction(notificationId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  if (typeof notificationId !== "string" || notificationId.length === 0) {
    throw new Error("Missing notification id.");
  }

  await markNotificationRead(session.user.id, notificationId);
  revalidatePath("/account/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  await markAllNotificationsRead(session.user.id);
  revalidatePath("/account/notifications");
  revalidatePath("/");
}
