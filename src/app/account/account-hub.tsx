"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  BellRing,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  HelpCircle,
  LogOut,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, useTransition } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { LOCALE_LABELS, LOCALE_NAMES, LOCALES, getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";
import { saveAppearanceAction } from "@/app/account/appearance-actions";
import { tapHaptic } from "@/lib/native/haptics";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/race";

type HubUser = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: UserRole;
  unreadCount: number;
  supportUnreadCount: number;
};

const THEMES = [
  { value: "light", labelKey: "themeLight", icon: Sun },
  { value: "dark", labelKey: "themeDark", icon: Moon },
  { value: "race", labelKey: "themeRace", icon: Sparkles }
] as const;
type ThemeMode = (typeof THEMES)[number]["value"];

// Mobile-first account & settings hub. Replaces the header dropdown menus on the phone:
// profile, the account screens, appearance, and language all live here as native list rows.
export function AccountHub({ user }: { user: HubUser | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const dict = getDictionary(locale);
  const t = dict.account;
  const [signingOut, startSignOut] = useTransition();

  const isOrganizer = user?.role === "ORGANIZER" || user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        {user ? (
          <>
            {/* Profile */}
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-lg font-black text-brand-teal">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="" width={56} height={56} className="size-full object-cover" />
                ) : (
                  <span>{getInitials(user.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-gray-950">{user.name}</p>
                <p className="truncate text-sm text-gray-500">{user.email}</p>
              </div>
            </div>

            <SectionLabel>{t.account}</SectionLabel>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <Row href="/account/registrations" icon={ClipboardList} label={t.myRegistrations} />
              <Row href="/account/profile" icon={UserRound} label={t.profileSettings} />
              <Row href="/account/notifications" icon={Bell} label={t.notifications} badge={user.unreadCount} />
              <Row href="/account/support" icon={MessageCircle} label={t.support} badge={user.supportUnreadCount} />
              <Row href="/faq" icon={HelpCircle} label={dict.nav.faq} />
              <Row href="/account/notification-settings" icon={BellRing} label={t.notificationSettings} last />
            </div>

            <SectionLabel>{t.coach}</SectionLabel>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <Row href="/account/coach" icon={Sparkles} label={t.coach} />
              <Row href="/account/coach/subscribe" icon={CreditCard} label={t.coachSubscription} last />
            </div>

            <SectionLabel>{t.workspace}</SectionLabel>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {user.role === "RUNNER" ? <Row href="/organizer/request" icon={Building2} label={t.requestOrganizer} last={!isAdmin && !isOrganizer} /> : null}
              {isOrganizer ? <Row href="/organizer" icon={Building2} label={t.organizerDashboard} last={!isAdmin} /> : null}
              {isAdmin ? <Row href="/admin" icon={ShieldCheck} label={t.adminDashboard} last /> : null}
            </div>
          </>
        ) : (
          // Logged out: prompt to sign in, but keep Appearance + Language reachable below.
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
              <UserRound className="size-6" aria-hidden="true" />
            </div>
            <p className="text-lg font-black text-gray-950">{t.signedOut}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">{t.signedOutText}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={withLocale("/login", locale)}
                onClick={() => tapHaptic("light")}
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-black text-white transition active:scale-95"
              >
                <LogIn className="size-4" aria-hidden="true" />
                {t.signIn}
              </Link>
              <Link
                href={withLocale("/register", locale)}
                onClick={() => tapHaptic("light")}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-black text-gray-900 transition active:scale-95"
              >
                <UserPlus className="size-4" aria-hidden="true" />
                {t.signUp}
              </Link>
            </div>
          </div>
        )}

        <SectionLabel>{t.appearance}</SectionLabel>
        <ThemePicker labels={t} loggedIn={Boolean(user)} />

        <SectionLabel>{t.language}</SectionLabel>
        <LanguagePicker current={locale} pathname={pathname} searchParams={searchParams} loggedIn={Boolean(user)} />

        {user ? (
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              tapHaptic("medium");
              startSignOut(() => {
                // Full navigation so the server-rendered header (root layout) resets to
                // the logged-out state — client navigation alone keeps the cached header.
                void signOut({ redirect: false }).then(() => {
                  window.location.assign(withLocale("/login", locale));
                });
              });
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-black text-red-600 shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {signingOut ? t.signingOut : t.signOut}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-2 mt-6 px-1 text-xs font-black uppercase tracking-wide text-gray-500">{children}</p>;
}

function Row({
  href,
  icon: Icon,
  label,
  badge,
  last
}: {
  href: string;
  icon: typeof UserRound;
  label: string;
  badge?: number;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={() => tapHaptic("light")}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 transition active:bg-gray-50",
        !last && "border-b border-gray-100"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="flex-1 text-sm font-bold text-gray-900">{label}</span>
      {badge && badge > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-black text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
      <ChevronRight className="size-4 text-gray-400" aria-hidden="true" />
    </Link>
  );
}

function ThemePicker({ labels, loggedIn }: { labels: ReturnType<typeof getDictionary>["account"]; loggedIn: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("racedz-theme");
    setTheme(isThemeMode(saved) ? saved : "light");
  }, []);

  function pick(next: ThemeMode) {
    tapHaptic("light");
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("racedz-theme", next);
    // Signed-in: persist so the choice follows the runner to other devices.
    if (loggedIn) void saveAppearanceAction({ theme: next });
  }

  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
      {THEMES.map(({ value, labelKey, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => pick(value)}
          aria-pressed={theme === value}
          className={cn(
            "flex min-h-[3.25rem] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-black transition active:scale-95",
            theme === value ? "bg-gray-950 text-white" : "text-gray-700 hover:bg-gray-100"
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
          {labels[labelKey]}
        </button>
      ))}
    </div>
  );
}

function LanguagePicker({
  current,
  pathname,
  searchParams,
  loggedIn
}: {
  current: Locale;
  pathname: string;
  searchParams: URLSearchParams;
  loggedIn: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
      {LOCALES.map((loc) => (
        <Link
          key={loc}
          href={localeHref(pathname, searchParams, loc)}
          onClick={() => {
            tapHaptic("light");
            document.cookie = `racedz-locale=${loc}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
            // Signed-in: persist so the language follows the runner to other devices.
            if (loggedIn) void saveAppearanceAction({ language: loc });
          }}
          aria-current={current === loc ? "true" : undefined}
          className={cn(
            "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-center transition active:scale-95",
            current === loc ? "bg-gray-950 text-white" : "text-gray-700 hover:bg-gray-100"
          )}
        >
          <span className="text-xs font-black">{LOCALE_LABELS[loc]}</span>
          <span className="text-[11px] font-bold opacity-80">{LOCALE_NAMES[loc]}</span>
        </Link>
      ))}
    </div>
  );
}

function localeHref(pathname: string, searchParams: URLSearchParams, locale: Locale) {
  const params = new URLSearchParams(searchParams.toString());
  if (locale === "en") params.delete("lang");
  else params.set("lang", locale);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "race";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.charAt(0) ?? "R"}${parts[1]?.charAt(0) ?? ""}`.toUpperCase();
}
