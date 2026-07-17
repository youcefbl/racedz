"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarSearch, Footprints, Sparkles, UserRound } from "lucide-react";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { tapHaptic } from "@/lib/native/haptics";
import { cn } from "@/lib/utils";

// Bottom tab bar shown only inside the native app (gated by the `.native-app` class in CSS).
// Always rendered so there's no hydration mismatch; CSS hides it on the website.
export function MobileTabBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const nav = getDictionary(locale).nav;

  const tabs = [
    // Races is the app home now (also active on the marketing "/" landing).
    { href: "/races", icon: CalendarSearch, label: nav.races, active: pathname === "/" || pathname.startsWith("/races") },
    { href: "/account/runs", icon: Footprints, label: nav.runs, active: pathname.startsWith("/account/runs") },
    { href: "/account/coach", icon: Sparkles, label: nav.coach, active: pathname.startsWith("/account/coach") },
    {
      href: "/account",
      icon: UserRound,
      label: nav.account,
      active:
        pathname.startsWith("/account") &&
        !pathname.startsWith("/account/coach") &&
        !pathname.startsWith("/account/runs")
    }
  ];

  return (
    <nav className="mobile-tab-bar" aria-label="App navigation" dir={locale === "ar" ? "rtl" : "ltr"}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={withLocale(tab.href, locale)}
          aria-current={tab.active ? "page" : undefined}
          className={cn("mobile-tab", tab.active && "mobile-tab-active", tab.href === "/account/runs" && "mobile-tab-primary")}
          onClick={() => tapHaptic("light")}
        >
          <span className="mobile-tab-icon" aria-hidden="true">
            <tab.icon className="size-5" strokeWidth={tab.active ? 2.4 : 2} />
          </span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
