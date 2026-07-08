import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPrisma } from "@/lib/db";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getUserSupportUnreadCount } from "@/lib/support";
import { AccountHub } from "./account-hub";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();

  // Logged out: still render the hub so Appearance + Language stay reachable in the app.
  if (!session?.user?.id) {
    return <AccountHub user={null} />;
  }

  const [user, unreadCount, supportUnreadCount] = await Promise.all([
    getPrisma().user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, email: true, avatarUrl: true, role: true, onboardedAt: true }
    }),
    getUnreadNotificationCount(session.user.id),
    getUserSupportUnreadCount(session.user.id)
  ]);

  if (!user) {
    return <AccountHub user={null} />;
  }

  // First-login welcome: send new runners through the (skippable) setup step once.
  if (!user.onboardedAt) {
    redirect("/account/welcome");
  }

  return (
    <AccountHub
      user={{
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        unreadCount,
        supportUnreadCount
      }}
    />
  );
}
