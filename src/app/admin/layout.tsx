import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DashboardShell section="admin">{children}</DashboardShell>;
}
