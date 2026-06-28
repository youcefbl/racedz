import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { auth } from "@/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getUserNotifications } from "@/lib/notifications";
import { NotificationsList } from "./notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const session = await auth();
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).notifications;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/notifications");
  }

  const notifications = await getUserNotifications(session.user.id);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-gray-950">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            {t.pageIntro}
          </p>
        </div>

        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title={t.emptyTitle} description={t.emptyText} />
        ) : (
          <NotificationsList notifications={notifications} locale={locale} />
        )}
      </div>
    </div>
  );
}
