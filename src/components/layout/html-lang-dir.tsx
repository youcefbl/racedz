"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getLocale } from "@/lib/i18n";

// Keeps <html lang> and <html dir> in sync with the active locale on client-side
// navigations (the language switcher uses next/link, so there is no full reload).
// The initial paint is handled by an inline script in the root layout to avoid a flash.
export function HtmlLangDir() {
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));

  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
