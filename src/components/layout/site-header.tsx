import { auth } from "@/auth";
import { SiteHeaderClient } from "@/components/layout/site-header-client";
import { getPrisma } from "@/lib/db";
import { getHeaderNotifications, getUnreadNotificationCount } from "@/lib/notifications";

export async function SiteHeader() {
  const session = await auth();
  const [user, unreadNotificationCount, notifications] = session?.user?.id
    ? await Promise.all([
        getPrisma().user.findUnique({
          where: {
            id: session.user.id
          },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true
          }
        }),
        getUnreadNotificationCount(session.user.id),
        getHeaderNotifications(session.user.id)
      ])
    : [null, 0, []];

  return (
    <SiteHeaderClient
      user={
        user
          ? {
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              avatarUrl: user.avatarUrl,
              role: user.role,
              unreadNotificationCount,
              notifications: notifications.map((notification) => ({
                id: notification.id,
                title: notification.title,
                body: notification.body,
                href: notification.href,
                readAt: notification.readAt?.toISOString() ?? null,
                createdAt: notification.createdAt.toISOString()
              }))
            }
          : undefined
      }
    />
  );
}
