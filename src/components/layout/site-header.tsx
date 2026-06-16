import { auth } from "@/auth";
import { SiteHeaderClient } from "@/components/layout/site-header-client";
import { getPrisma } from "@/lib/db";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user?.id
    ? await getPrisma().user.findUnique({
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
      })
    : null;

  return (
    <SiteHeaderClient
      user={
        user
          ? {
              name: `${user.firstName} ${user.lastName}`,
              email: user.email,
              avatarUrl: user.avatarUrl,
              role: user.role
            }
          : undefined
      }
    />
  );
}
