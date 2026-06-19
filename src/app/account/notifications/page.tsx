import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getUserNotifications, markAllNotificationsRead } from "@/lib/notifications";
import { markNotificationReadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/notifications");
  }

  await markAllNotificationsRead(session.user.id);
  const notifications = await getUserNotifications(session.user.id);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Account</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">Notifications</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Race approvals, registration updates, organizer messages, and account alerts appear here.
            </p>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
              <Bell className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-black text-gray-950">No notifications yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              New RaceDZ updates will appear here when there is something you need to review.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <ul className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <li key={notification.id} className={notification.readAt ? "p-4" : "bg-teal-50/60 p-4"}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!notification.readAt ? <span className="size-2 rounded-full bg-brand-orange" aria-label="Unread" /> : null}
                        <h2 className="text-sm font-black text-gray-950">{notification.title}</h2>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{notification.body}</p>
                      <p className="mt-2 text-xs font-semibold text-gray-500">{formatDate(notification.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {notification.href ? (
                        <Link
                          href={notification.href}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 transition hover:border-brand-teal hover:text-brand-teal"
                        >
                          Open
                          <ExternalLink className="size-4" aria-hidden="true" />
                        </Link>
                      ) : null}
                      {!notification.readAt ? (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notificationId" value={notification.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Mark read
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
