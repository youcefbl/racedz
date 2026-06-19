"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { notificationPreferenceOptions, updateNotificationPreferences } from "@/lib/notifications";

export async function updateNotificationSettingsAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/notification-settings");
  }

  await updateNotificationPreferences({
    userId: session.user.id,
    preferences: notificationPreferenceOptions.map((option) => ({
      type: option.type,
      inAppEnabled: true,
      pushEnabled: formData.get(`push:${option.type}`) === "on",
      emailEnabled: formData.get(`email:${option.type}`) === "on"
    }))
  });

  revalidatePath("/account/notification-settings");
  revalidatePath("/");
}
