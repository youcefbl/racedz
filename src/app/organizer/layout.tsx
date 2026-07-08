import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { assertNotBlocked } from "@/lib/account-guard";

export default async function OrganizerLayout({ children }: { children: ReactNode }) {
  await assertNotBlocked();
  return <DashboardShell section="organizer">{children}</DashboardShell>;
}
