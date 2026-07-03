"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bot,
  Building2,
  Settings,
  ClipboardList,
  History,
  LayoutDashboard,
  Lightbulb,
  ShieldCheck,
  Trophy,
  UsersRound
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getLocale, withLocale } from "@/lib/i18n";
import { translateOrganizer } from "@/lib/organizer-i18n";

type DashboardSection = "admin" | "organizer";

type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const adminNavItems: DashboardNavItem[] = [
  { href: "/admin", label: "Overview", description: "Platform health", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", description: "Accounts and roles", icon: UsersRound },
  { href: "/admin/organizations", label: "Organizations", description: "Organizer approvals", icon: Building2 },
  { href: "/admin/races", label: "Races", description: "Review and publish", icon: Trophy },
  { href: "/admin/registrations", label: "Registrations", description: "Runner entries", icon: ClipboardList },
  { href: "/admin/coach", label: "AI Coach", description: "Usage and subscriptions", icon: Bot },
  { href: "/admin/tips", label: "Coach tips", description: "Review and publish tips", icon: Lightbulb },
  { href: "/admin/audit", label: "Audit", description: "Admin action log", icon: History }
];

const organizerNavItems: DashboardNavItem[] = [
  { href: "/organizer", label: "Overview", description: "Organization status", icon: LayoutDashboard },
  { href: "/organizer/events", label: "Events", description: "Race management", icon: Trophy },
  { href: "/organizer/members", label: "Members", description: "Team access", icon: UsersRound },
  { href: "/organizer/settings", label: "Settings", description: "Profile and logo", icon: Settings }
];

export function DashboardShell({ section, children }: { section: DashboardSection; children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const t = (text: string) => (section === "organizer" ? translateOrganizer(locale, text) : text);

  if (section === "organizer" && pathname === "/organizer/request") {
    return <div dir={locale === "ar" ? "rtl" : "ltr"}>{children}</div>;
  }

  const items = section === "admin" ? adminNavItems : organizerNavItems;
  const title = t(section === "admin" ? "Admin panel" : "Organizer panel");
  const description = t(section === "admin" ? "Approvals, users, races, and platform operations." : "Events, participants, and organization team access.");

  return (
    <div className="bg-gray-50 lg:bg-white" dir={section === "organizer" && locale === "ar" ? "rtl" : "ltr"}>
      <div className="grid w-full lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <div className="px-4 py-4 sm:px-6 lg:px-5 lg:py-6">
            <div className="hidden lg:block">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-950">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">{description}</p>
                </div>
              </div>
            </div>

            <nav className="mt-0 flex gap-2 overflow-x-auto lg:mt-6 lg:grid lg:gap-1" aria-label={`${title} navigation`}>
              {items.map((item) => (
                <DashboardNavLink
                  key={item.href}
                  item={{ ...item, href: section === "organizer" ? withLocale(item.href, locale) : item.href, label: t(item.label), description: t(item.description) }}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </nav>
          </div>
        </aside>
        <div className="min-w-0 bg-gray-50">{children}</div>
      </div>
    </div>
  );
}

function DashboardNavLink({ item, active }: { item: DashboardNavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 lg:h-auto lg:w-full lg:items-start lg:px-3 lg:py-3",
        active
          ? "border-brand-teal bg-teal-50 text-brand-teal shadow-sm"
          : "border-gray-200 bg-white text-gray-700 hover:border-brand-teal hover:text-brand-teal lg:border-transparent lg:hover:bg-gray-50"
      )}
    >
      <item.icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand-teal" : "text-gray-400 group-hover:text-brand-teal")} aria-hidden={true} />
      <span className="lg:grid">
        <span>{item.label}</span>
        <span className={cn("hidden text-xs font-semibold lg:block", active ? "text-teal-700" : "text-gray-400")}>{item.description}</span>
      </span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/organizer") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
