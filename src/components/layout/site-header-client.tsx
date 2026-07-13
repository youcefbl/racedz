"use client";

import Link from "next/link";
import {
  Bell,
  BookOpen,
  BrainCircuit,
  Building2,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FileText,
  Footprints,
  HelpCircle,
  LogIn,
  Menu,
  Search,
  Tag,
  Trophy,
  UserPlus,
  UserRound,
  X
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccountMenu, type HeaderUser } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SettingsMenu } from "@/components/layout/settings-menu";
import { useMenuKeyboard } from "@/components/layout/use-menu-keyboard";
import { toast } from "@/components/ui/toast";
import { NativeHeader } from "@/components/layout/native-header";
import { ZidRunLogo } from "@/components/layout/racedz-logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { ButtonLink } from "@/components/ui/button";
import { getDictionary, getLocale, withLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function SiteHeaderClient({ user }: { user?: HeaderUser }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const dictionary = getDictionary(locale);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const desktopNavItems = [
    { href: "/races", label: dictionary.nav.races, icon: CalendarDays },
    { href: "/coach", label: dictionary.nav.aiCoach, icon: BrainCircuit },
    { href: "/blog", label: dictionary.nav.blog, icon: BookOpen },
    { href: "/pricing", label: dictionary.nav.pricing, icon: Tag },
    { href: "/rankings", label: dictionary.nav.rankings, icon: Trophy },
    { href: "/runners", label: dictionary.nav.forRunners, icon: Footprints },
    { href: "/organizers", label: dictionary.nav.organizers, icon: Building2 }
  ];

  const mobileNavItems = [
    ...desktopNavItems,
    { href: "/about", label: dictionary.nav.about, icon: HelpCircle },
    { href: "/contact", label: dictionary.nav.contact, icon: UserRound },
    { href: "/terms", label: dictionary.nav.terms, icon: FileText },
    { href: "/privacy", label: dictionary.nav.privacy, icon: FileText }
  ];

  return (
    <>
      <NativeHeader user={user} />
      <header
        className={cn(
          "site-header sticky top-0 z-30 border-b border-[var(--border)] backdrop-blur-xl transition-shadow duration-300",
          scrolled ? "bg-[var(--surface)]/95 shadow-sm" : "bg-[var(--surface)]/90"
        )}
      >
      <div
        className={cn(
          "site-header-stripe bg-[linear-gradient(90deg,var(--primary),var(--accent),#9b5cff)] transition-all duration-300",
          scrolled ? "h-0.5 opacity-70" : "h-1 opacity-100"
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "site-header-row flex items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-6 lg:px-8",
          scrolled ? "h-14" : "h-[4.25rem]"
        )}
      >
        <div className="flex min-w-0 items-center gap-2 lg:gap-4">
          <ZidRunLogo animated />
          <span className="hidden h-7 w-px bg-[var(--border)] lg:block" aria-hidden="true" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {desktopNavItems.map((item) => (
              <HeaderNavLink
                key={item.href}
                href={withLocale(item.href, locale)}
                active={isActivePath(pathname, item.href)}
                icon={item.icon}
              >
                {item.label}
              </HeaderNavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="hidden items-center md:flex">
            <SettingsMenu currentLocale={locale} persist={Boolean(user)} />
          </div>
          <span className="hidden h-7 w-px bg-[var(--border)] md:block" aria-hidden="true" />
          {user ? (
            <>
              <NotificationDropdown
                count={user.unreadNotificationCount ?? 0}
                notifications={user.notifications ?? []}
                locale={locale}
              />
              <AccountMenu user={user} locale={locale} />
            </>
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <ButtonLink href={withLocale("/login", locale)} variant="ghost" size="sm">
                <LogIn className="size-4" aria-hidden="true" />
                {dictionary.nav.login}
              </ButtonLink>
              <ButtonLink href={withLocale("/register", locale)} variant="outline" size="sm">
                <UserPlus className="size-4" aria-hidden="true" />
                {dictionary.nav.signUp}
              </ButtonLink>
            </div>
          )}
          <ButtonLink href={withLocale("/races", locale)} variant="secondary" size="sm" className="site-header-cta hidden shadow-sm md:inline-flex">
            <Search className="size-4" aria-hidden="true" />
            {dictionary.nav.findRace}
          </ButtonLink>
          <button
            type="button"
            aria-label={mobileOpen ? dictionary.nav.closeMenu : dictionary.nav.openMenu}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange md:hidden"
          >
            {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] shadow-soft md:hidden">
          <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6">
            <div className="grid gap-2">
              <ButtonLink href={withLocale("/races", locale)} variant="secondary" size="lg" className="site-header-cta" onClick={() => setMobileOpen(false)}>
                <Search className="size-5" aria-hidden="true" />
                {dictionary.nav.findRace}
              </ButtonLink>
              {!user ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <ButtonLink href={withLocale("/login", locale)} variant="outline" size="lg" onClick={() => setMobileOpen(false)}>
                    <LogIn className="size-5" aria-hidden="true" />
                    {dictionary.nav.login}
                  </ButtonLink>
                  <ButtonLink href={withLocale("/register", locale)} variant="outline" size="lg" onClick={() => setMobileOpen(false)}>
                    <UserPlus className="size-5" aria-hidden="true" />
                    {dictionary.nav.signUp}
                  </ButtonLink>
                </div>
              ) : null}
            </div>

            <nav className="grid gap-2 border-t border-[var(--border)] pt-4" aria-label="Mobile navigation">
              {mobileNavItems.map((item) => (
                <MobileNavLink
                  key={item.href}
                  href={withLocale(item.href, locale)}
                  active={isActivePath(pathname, item.href)}
                  icon={item.icon}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </MobileNavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4">
              <ThemeSwitcher persist={Boolean(user)} />
              <LanguageSwitcher currentLocale={locale} persist={Boolean(user)} />
            </div>
          </div>
        </div>
      ) : null}
      </header>
    </>
  );
}

function HeaderNavLink({
  href,
  active,
  icon: Icon,
  children
}: {
  href: string;
  active: boolean;
  icon: typeof CalendarDays;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
        active
          ? "bg-[var(--surface-soft)] text-brand-teal"
          : "text-[var(--text)] hover:bg-[var(--surface-soft)] hover:text-brand-teal"
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
      {active ? <span className="absolute inset-x-4 -bottom-3 h-0.5 rounded-full bg-brand-orange" aria-hidden="true" /> : null}
    </Link>
  );
}

function MobileNavLink({
  href,
  active,
  icon: Icon,
  onClick,
  children
}: {
  href: string;
  active: boolean;
  icon: typeof CalendarDays;
  onClick: () => void;
  children: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center justify-between rounded-lg border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
        active
          ? "border-brand-teal bg-[var(--primary-soft)] text-brand-teal"
          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] hover:border-brand-teal hover:text-brand-teal"
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="size-4" aria-hidden="true" />
        {children}
      </span>
      <ChevronRight className="size-4 text-[var(--text-muted)] rtl:rotate-180" aria-hidden="true" />
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NotificationDropdown({
  count,
  notifications,
  locale
}: {
  count: number;
  notifications: NonNullable<HeaderUser["notifications"]>;
  locale: Locale;
}) {
  const t = getDictionary(locale).notifications;
  const [open, setOpen] = useState(false);
  const [localCount, setLocalCount] = useState(count);
  const [items, setItems] = useState(notifications);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { onKeyDown } = useMenuKeyboard({ open, setOpen, menuRef, triggerRef });

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
    // Opening no longer marks anything read — the user triages per item (or uses "Mark all read").
    setOpen((current) => !current);
  }

  function markItemRead(id: string) {
    const target = items.find((item) => item.id === id);
    if (!target || target.readAt) return; // already read — nothing to do

    const previousItems = items;
    const previousCount = localCount;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? readAt } : item)));
    setLocalCount((current) => Math.max(0, current - 1));
    void fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {
      setItems(previousItems);
      setLocalCount(previousCount);
      toast(t.markReadError, "error");
    });
  }

  function markAllRead() {
    if (localCount === 0) return;
    const previousItems = items;
    const previousCount = localCount;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    setLocalCount(0);
    void fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {
      setItems(previousItems);
      setLocalCount(previousCount);
      toast(t.markReadError, "error");
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={localCount > 0 ? t.unreadCount.replace("{count}", String(localCount)) : t.panelTitle}
        title={localCount > 0 ? t.unreadCount.replace("{count}", String(localCount)) : t.panelTitle}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openNotifications}
        className="relative inline-flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        <Bell className="size-5" aria-hidden="true" />
        {localCount > 0 ? (
          <span className="absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-xs font-bold text-[#18001c]">
            {localCount > 9 ? "9+" : localCount}
          </span>
        ) : null}
      </button>

      {open ? <div className="rz-pop-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <div
          className="rz-pop absolute end-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-soft"
          role="menu"
          aria-label={t.panelTitle}
          onKeyDown={onKeyDown}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-strong)]">{t.panelTitle}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{items.length > 0 ? t.panelSubtitle : t.panelEmpty}</p>
            </div>
            {localCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-teal transition hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              >
                {t.markAllRead.replace("{count}", String(localCount))}
              </button>
            ) : null}
          </div>
          {items.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {items.map((item) => {
                const unread = !item.readAt;
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text-strong)]">
                        {unread ? <span className="me-1.5 inline-block size-2 rounded-full bg-brand-orange align-middle" aria-hidden="true" /> : null}
                        {item.title}
                      </p>
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
                    onClick={() => {
                      markItemRead(item.id);
                      setOpen(false);
                    }}
                    className="block border-b border-[var(--border)] px-4 py-3 transition last:border-b-0 hover:bg-[var(--surface-soft)]"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => markItemRead(item.id)}
                    className="block w-full border-b border-[var(--border)] px-4 py-3 text-start transition last:border-b-0 hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal"
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto size-8 text-brand-teal" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">{t.panelCaughtUp}</p>
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
