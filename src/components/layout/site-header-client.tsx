"use client";

import Link from "next/link";
import { Bell, CalendarDays, ExternalLink, FileText, HelpCircle, Menu, UserRound, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccountMenu, type HeaderUser } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { RaceDZLogo } from "@/components/layout/racedz-logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { ButtonLink } from "@/components/ui/button";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function SiteHeaderClient({ user }: { user?: HeaderUser }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const dictionary = getDictionary(locale);
  const [mobileOpen, setMobileOpen] = useState(false);

  const desktopNavItems = [
    { href: "/races", label: dictionary.nav.races, icon: CalendarDays },
    { href: "/organizers", label: dictionary.nav.organizers, icon: UserRound }
  ];

  const mobileNavItems = [
    ...desktopNavItems,
    { href: "/about", label: dictionary.nav.about, icon: HelpCircle },
    { href: "/contact", label: dictionary.nav.contact, icon: UserRound },
    { href: "/terms", label: dictionary.nav.terms, icon: FileText },
    { href: "/privacy", label: dictionary.nav.privacy, icon: FileText }
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <RaceDZLogo />
        <nav className="hidden items-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-1 md:flex" aria-label="Primary navigation">
          {desktopNavItems.map((item) => (
            <HeaderNavLink key={item.href} href={withLocale(item.href, locale)} active={isActivePath(pathname, item.href)}>
              {item.label}
            </HeaderNavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex md:items-center md:gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher currentLocale={locale} />
          </div>
          {user ? (
            <>
              <NotificationDropdown
                count={user.unreadNotificationCount ?? 0}
                notifications={user.notifications ?? []}
              />
              <AccountMenu user={user} />
            </>
          ) : (
            <ButtonLink href={withLocale("/login", locale)} variant="outline" size="sm" className="hidden sm:inline-flex">
              {dictionary.nav.login}
            </ButtonLink>
          )}
          <ButtonLink href={withLocale("/races", locale)} variant="secondary" size="sm" className="hidden sm:inline-flex">
            {dictionary.nav.findRace}
          </ButtonLink>
          <button
            type="button"
            aria-label={mobileOpen ? dictionary.nav.closeMenu : dictionary.nav.openMenu}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--text)] transition hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange md:hidden"
          >
            {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] md:hidden">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-4 sm:px-6">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {mobileNavItems.map((item) => (
                <ButtonLink
                  key={item.href}
                  href={withLocale(item.href, locale)}
                  variant="ghost"
                  size="md"
                  className={cn("justify-start", isActivePath(pathname, item.href) ? "bg-[var(--surface-soft)] text-brand-teal" : "")}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </ButtonLink>
              ))}
            </nav>
            <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
              <ThemeSwitcher />
              <LanguageSwitcher currentLocale={locale} />
            </div>
            {!user ? (
              <div className="grid gap-2 border-t border-[var(--border)] pt-3 sm:hidden">
                <ButtonLink href={withLocale("/login", locale)} variant="outline" size="md">
                  {dictionary.nav.login}
                </ButtonLink>
                <ButtonLink href={withLocale("/races", locale)} variant="secondary" size="md">
                  {dictionary.nav.findRace}
                </ButtonLink>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeaderNavLink({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
        active
          ? "bg-[var(--surface)] text-brand-teal shadow-sm"
          : "text-[var(--text)] hover:bg-[var(--surface)] hover:text-brand-teal"
      )}
    >
      {children}
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NotificationDropdown({
  count,
  notifications
}: {
  count: number;
  notifications: NonNullable<HeaderUser["notifications"]>;
}) {
  const [open, setOpen] = useState(false);
  const [localCount, setLocalCount] = useState(count);
  const [items, setItems] = useState(notifications);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalCount(count);
  }, [count]);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openNotifications() {
    setOpen((current) => {
      const next = !current;

      if (next && localCount > 0) {
        const readAt = new Date().toISOString();
        setLocalCount(0);
        setItems((currentItems) => currentItems.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
        void fetch("/api/notifications/read-all", { method: "POST" });
      }

      return next;
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={localCount > 0 ? `${localCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openNotifications}
        className="relative inline-flex size-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        <Bell className="size-5" aria-hidden="true" />
        {localCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-black text-white">
            {localCount > 9 ? "9+" : localCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-soft"
          role="menu"
        >
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-sm font-black text-[var(--text-strong)]">Notifications</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{items.length > 0 ? "Latest RaceDZ updates" : "No updates yet"}</p>
          </div>
          {items.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {items.map((item) => {
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-[var(--text-strong)]">{item.title}</p>
                      {item.href ? <ExternalLink className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--text)]">{item.body}</p>
                    <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">{formatNotificationDate(item.createdAt)}</p>
                  </>
                );

                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="block border-b border-[var(--border)] px-4 py-3 transition last:border-b-0 hover:bg-[var(--surface-soft)]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={item.id} role="menuitem" className="border-b border-[var(--border)] px-4 py-3 last:border-b-0">
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto size-8 text-brand-teal" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">You are all caught up.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
