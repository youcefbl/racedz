import { redirect } from "next/navigation";
import { Bell, Check, Mail, Smartphone } from "lucide-react";
import { auth } from "@/auth";
import { PushNotificationControl } from "@/components/notifications/push-notification-control";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getNotificationPreferences } from "@/lib/notifications";
import { updateNotificationSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage({ searchParams }: { searchParams?: Promise<{ lang?: string; saved?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = getDictionary(locale).notificationSettings;
  const justSaved = params?.saved === "1";

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/notification-settings");
  }

  const preferences = await getNotificationPreferences(session.user.id);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-950">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            {t.intro}
          </p>
        </div>

        <div aria-live="polite" className="empty:hidden">
          {justSaved ? (
            <p role="status" className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              {t.saved}
            </p>
          ) : null}
        </div>

        <PushNotificationControl />

        <form action={updateNotificationSettingsAction} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <input type="hidden" name="lang" value={locale} />
          <div className="grid grid-cols-[1fr_3rem_3rem] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-black uppercase tracking-normal text-gray-500">
            <span>{t.columnNotification}</span>
            <span className="flex flex-col items-center gap-1 text-center">
              <Mail className="size-4" aria-hidden="true" />
              {t.columnEmail}
            </span>
            <span className="flex flex-col items-center gap-1 text-center">
              <Smartphone className="size-4" aria-hidden="true" />
              {t.columnPush}
            </span>
          </div>

          <div className="divide-y divide-gray-200">
            {preferences.map((preference) => (
              <div key={preference.type} className="grid grid-cols-[1fr_3rem_3rem] items-center gap-3 px-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                    <h2 className="text-sm font-black text-gray-950">{preference.title}</h2>
                  </div>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600">{preference.description}</p>
                </div>
                <label className="mx-auto flex size-11 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white">
                  <span className="sr-only">{t.emailFor.replace("{name}", preference.title)}</span>
                  <input
                    type="checkbox"
                    name={`email:${preference.type}`}
                    defaultChecked={preference.emailEnabled}
                    className="size-4 accent-brand-teal"
                  />
                </label>
                <label className="mx-auto flex size-11 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white">
                  <span className="sr-only">{t.pushFor.replace("{name}", preference.title)}</span>
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
              {t.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
