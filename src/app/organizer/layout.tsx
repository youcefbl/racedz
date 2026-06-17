import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function OrganizerLayout({ children }: { children: ReactNode }) {
  return <DashboardShell section="organizer">{children}</DashboardShell>;
}
