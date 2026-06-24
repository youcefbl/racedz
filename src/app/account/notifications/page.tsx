import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { auth } from "@/auth";
import { getUserNotifications } from "@/lib/notifications";
import { NotificationsList } from "./notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/notifications");
  }

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
          <NotificationsList notifications={notifications} />
        )}
      </div>
    </div>
  );
}
