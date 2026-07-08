import type { ReactNode } from "react";
import { assertNotBlocked } from "@/lib/account-guard";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // Kick blocked accounts out of the app even if their session is still valid.
  await assertNotBlocked();
  return <>{children}</>;
}
