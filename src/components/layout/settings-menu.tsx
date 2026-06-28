"use client";

import Link from "next/link";
import { Check, Globe, Moon, Settings, Sparkles, Sun } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALE_NAMES, LOCALES, getDictionary, type Locale } from "@/lib/i18n";
import { useMenuKeyboard } from "@/components/layout/use-menu-keyboard";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "race", icon: Sparkles }
] as const;

type ThemeMode = (typeof THEMES)[number]["value"];

// One "Settings" popover that folds theme + language together, so the desktop
// header reads as nav · notifications · account · Find race instead of five
// competing controls. (The mobile drawer keeps the standalone switchers.)
export function SettingsMenu({ currentLocale }: { currentLocale: Locale }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { onKeyDown } = useMenuKeyboard({ open, setOpen, menuRef, triggerRef });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = getDictionary(currentLocale).account;
  const themeLabels: Record<ThemeMode, string> = {
    light: t.themeLight,
    dark: t.themeDark,
    race: t.themeRace
  };

  useEffect(() => {
    const saved = window.localStorage.getItem("racedz-theme");
    setTheme(isThemeMode(saved) ? saved : "light");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function selectTheme(next: ThemeMode) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("racedz-theme", next);
  }

  function localeHref(locale: Locale) {
    const params = new URLSearchParams(searchParams.toString());
    if (locale === "en") params.delete("lang");
    else params.set("lang", locale);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function persistLocale(locale: Locale) {
    document.cookie = `racedz-locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t.settings}
        title={t.settings}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        <Settings className="size-[18px]" aria-hidden="true" />
      </button>

      {open ? <div className="rz-pop-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <div
          className="rz-pop absolute end-0 top-12 z-50 w-56 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-soft"
          role="menu"
          aria-label={t.settings}
          onKeyDown={onKeyDown}
        >
          <p className="px-2 pb-1 pt-1 text-xs font-bold text-[var(--text-muted)]">{t.appearance}</p>
          {THEMES.map((item) => {
            const Icon = item.icon;
            const active = theme === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => selectTheme(item.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-start text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
                  active ? "bg-[var(--primary-soft)] text-brand-teal" : "text-[var(--text)] hover:bg-[var(--surface-soft)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4" aria-hidden="true" />
                  {themeLabels[item.value]}
                </span>
                {active ? <Check className="size-4" aria-hidden="true" /> : null}
              </button>
            );
          })}

          <p className="mt-1 border-t border-[var(--border)] px-2 pb-1 pt-2 text-xs font-bold text-[var(--text-muted)]">
            {t.language}
          </p>
          {LOCALES.map((locale) => {
            const active = currentLocale === locale;
            return (
              <Link
                key={locale}
                href={localeHref(locale)}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  persistLocale(locale);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
                  active ? "bg-[var(--primary-soft)] text-brand-teal" : "text-[var(--text)] hover:bg-[var(--surface-soft)]"
                )}
              >
                <span className="flex items-center gap-2">
                  <Globe className="size-4" aria-hidden="true" />
                  {LOCALE_NAMES[locale]}
                </span>
                {active ? <Check className="size-4" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "race";
}
