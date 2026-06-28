"use client";

import Link from "next/link";
import { ChevronLeft, Bell } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HeaderUser } from "@/components/layout/account-menu";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { tapHaptic } from "@/lib/native/haptics";

// App-style top bar shown ONLY inside the native app (toggled by `.native-app` in CSS).
// Contextual: a left-aligned screen title, a back chevron on non-root screens, and a
// notifications bell. Theme/language/account live in the Settings + Account screens, not here.
const TAB_ROOTS = new Set(["/", "/races", "/account/coach", "/account"]);

export function NativeHeader({ user }: { user?: HeaderUser }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = getLocale(searchParams.get("lang"));
  const dict = getDictionary(locale);

  const title = getScreenTitle(pathname, dict);
  const isRoot = TAB_ROOTS.has(pathname);
  const unread = user?.unreadNotificationCount ?? 0;

  return (
    <header className="native-header" aria-label="App header">
      <div className="native-header-row">
        <div className="flex min-w-0 items-center gap-1.5">
          {!isRoot ? (
            <button
              type="button"
              aria-label={dict.account.back}
              onClick={() => {
                tapHaptic("light");
                router.back();
              }}
              className="native-header-back"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
          ) : null}
          <h1 className="native-header-title">{title}</h1>
        </div>

        {user ? (
          <Link
            href={withLocale("/account/notifications", locale)}
            aria-label={unread > 0 ? dict.notifications.unreadCount.replace("{count}", String(unread)) : dict.notifications.title}
            onClick={() => tapHaptic("light")}
            className="native-header-action"
          >
            <Bell className="size-5" aria-hidden="true" />
            {unread > 0 ? <span className="native-header-badge">{unread > 9 ? "9+" : unread}</span> : null}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function getScreenTitle(pathname: string, dict: ReturnType<typeof getDictionary>): string {
  const nav = dict.nav;
  if (pathname === "/") return "ZidRun";
  if (pathname.startsWith("/account/coach")) return nav.coach;
  if (pathname.startsWith("/account/notification-settings")) return dict.account.settings;
  if (pathname.startsWith("/account/notifications")) return dict.notifications.title;
  if (pathname.startsWith("/account/profile")) return dict.account.profile;
  if (pathname.startsWith("/account/registrations")) return nav.account;
  if (pathname.startsWith("/account")) return nav.account;
  if (pathname.startsWith("/races")) return nav.races;
  if (pathname.startsWith("/runners")) return nav.forRunners;
  if (pathname.startsWith("/organizers")) return nav.organizers;
  if (pathname.startsWith("/rankings")) return nav.rankings;
  if (pathname.startsWith("/about")) return nav.about;
  if (pathname.startsWith("/contact")) return nav.contact;
  // Fallback: title-case the last path segment.
  const seg = pathname.split("/").filter(Boolean).pop() ?? "ZidRun";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}
