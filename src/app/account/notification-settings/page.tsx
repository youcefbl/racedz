import { redirect } from "next/navigation";
import { Bell, Mail, Smartphone } from "lucide-react";
import { auth } from "@/auth";
import { PushNotificationControl } from "@/components/notifications/push-notification-control";
import { Button } from "@/components/ui/button";
import { getNotificationPreferences } from "@/lib/notifications";
import { updateNotificationSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/notification-settings");
  }

  const preferences = await getNotificationPreferences(session.user.id);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Account</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">Notification settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Choose which RaceDZ updates can reach you by email or push. In-app notifications stay enabled for important account history.
          </p>
        </div>

        <PushNotificationControl />

        <form action={updateNotificationSettingsAction} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-black uppercase tracking-normal text-gray-500">
            <span>Notification</span>
            <span className="inline-flex items-center gap-1">
              <Mail className="size-4" aria-hidden="true" />
              Email
            </span>
            <span className="inline-flex items-center gap-1">
              <Smartphone className="size-4" aria-hidden="true" />
              Push
            </span>
          </div>

          <div className="divide-y divide-gray-200">
            {preferences.map((preference) => (
              <div key={preference.type} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                    <h2 className="text-sm font-black text-gray-950">{preference.title}</h2>
                  </div>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600">{preference.description}</p>
                </div>
                <label className="flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white">
                  <span className="sr-only">Email for {preference.title}</span>
                  <input
                    type="checkbox"
                    name={`email:${preference.type}`}
                    defaultChecked={preference.emailEnabled}
                    className="size-4 accent-brand-teal"
                  />
                </label>
                <label className="flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white">
                  <span className="sr-only">Push for {preference.title}</span>
                  <input
                    type="checkbox"
                    name={`push:${preference.type}`}
                    defaultChecked={preference.pushEnabled}
                    className="size-4 accent-brand-teal"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-4 py-4">
            <Button type="submit" size="md">
              Save settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
