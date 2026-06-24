"use client";

import Link from "next/link";
import { Check, Globe } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية"
};

export function LanguageSwitcher({ currentLocale }: { currentLocale?: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedLocale = currentLocale ?? getCurrentLocale(searchParams.get("lang"));
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={`Language: ${LOCALE_NAMES[selectedLocale]}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm font-black text-[var(--text)] shadow-sm transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        <Globe className="size-[18px]" aria-hidden="true" />
        <span>{LOCALE_LABELS[selectedLocale]}</span>
      </button>

      {open ? <div className="rz-pop-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <div className="rz-pop absolute right-0 top-12 z-50 w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-soft" role="menu">
          {LOCALES.map((locale) => (
            <Link
              key={locale}
              href={getLocaleHref(pathname, searchParams, locale)}
              role="menuitemradio"
              aria-checked={selectedLocale === locale}
              onClick={() => {
                persistLocale(locale);
                setOpen(false);
              }}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
                selectedLocale === locale ? "bg-[var(--primary-soft)] text-brand-teal" : "text-[var(--text)] hover:bg-[var(--surface-soft)]"
              )}
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-xs font-black text-[var(--text-muted)]">{LOCALE_LABELS[locale]}</span>
                {LOCALE_NAMES[locale]}
              </span>
              {selectedLocale === locale ? <Check className="size-4" aria-hidden="true" /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function persistLocale(locale: Locale) {
  document.cookie = `racedz-locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function getLocaleHref(pathname: string, searchParams: URLSearchParams, locale: Locale) {
  const params = new URLSearchParams(searchParams.toString());

  if (locale === "en") {
    params.delete("lang");
  } else {
    params.set("lang", locale);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getCurrentLocale(value: string | null): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}
