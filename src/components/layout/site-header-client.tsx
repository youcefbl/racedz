"use client";

import { CalendarDays, ShieldCheck, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AccountMenu, type HeaderUser } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { RaceDZLogo } from "@/components/layout/racedz-logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { ButtonLink } from "@/components/ui/button";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";

export function SiteHeaderClient({ user }: { user?: HeaderUser }) {
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const dictionary = getDictionary(locale);
  const navItems = [
    { href: "/races", label: dictionary.nav.races, icon: CalendarDays },
    { href: "/organizer", label: dictionary.nav.organizers, icon: UserRound },
    { href: "/admin", label: dictionary.nav.admin, icon: ShieldCheck }
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <RaceDZLogo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <ButtonLink key={item.href} href={withLocale(item.href, locale)} variant="ghost" size="sm">
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </ButtonLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher currentLocale={locale} />
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <ButtonLink href={withLocale("/login", locale)} variant="outline" size="sm" className="hidden sm:inline-flex">
              {dictionary.nav.login}
            </ButtonLink>
          )}
          <ButtonLink href={withLocale("/races", locale)} variant="secondary" size="sm">
            {dictionary.nav.findRace}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
