"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readCookieConsent, writeCookieConsent, type CookieConsent } from "@/lib/cookie-consent";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";

// First-visit cookie notice. Records an explicit Accept / Reject choice (honored by the
// analytics tracker) and links to the cookie details in the privacy policy. Renders nothing
// once a choice exists. Mounted globally in the root layout.
export function CookieConsent() {
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const t = getDictionary(locale).pages.cookieBanner;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Defer to the client so we never flash the banner for users who already chose.
    setVisible(readCookieConsent() === null);
  }, []);

  function choose(value: CookieConsent) {
    writeCookieConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      dir={locale === "ar" ? "rtl" : "ltr"}
      role="dialog"
      aria-label="Cookies"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-sm leading-6 text-gray-600">
          {t.message}{" "}
          <Link href={withLocale("/privacy", locale) + "#cookies"} className="font-bold text-brand-teal underline-offset-4 hover:underline">
            {t.learnMore}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-800 transition hover:bg-gray-50 active:scale-95 sm:flex-none"
          >
            {t.reject}
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-teal px-5 text-sm font-black text-white transition hover:bg-brand-teal/90 active:scale-95 sm:flex-none"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
