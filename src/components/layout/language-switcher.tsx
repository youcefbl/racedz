"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ currentLocale }: { currentLocale?: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedLocale = currentLocale ?? getCurrentLocale(searchParams.get("lang"));

  return (
    <div className="flex rounded-lg border border-gray-200 bg-white p-1" aria-label="Language selector">
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={getLocaleHref(pathname, searchParams, locale)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-bold transition",
            selectedLocale === locale ? "bg-brand-teal text-white" : "text-gray-600 hover:bg-gray-100"
          )}
          aria-current={selectedLocale === locale ? "page" : undefined}
        >
          {LOCALE_LABELS[locale]}
        </Link>
      ))}
    </div>
  );
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
