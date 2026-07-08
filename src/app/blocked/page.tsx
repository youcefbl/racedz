import type { Metadata } from "next";
import Link from "next/link";
import { Ban } from "lucide-react";
import { BlockedNotice } from "@/components/layout/blocked-notice";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account blocked"
};

export default async function BlockedPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).pages.blocked;

  return (
    <div className="bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <BlockedNotice />
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <Ban className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">{t.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">{t.message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={withLocale("/contact", locale)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-teal px-5 text-sm font-black text-white transition active:scale-95"
          >
            {t.contactCta}
          </Link>
          <Link
            href={withLocale("/", locale)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-5 text-sm font-bold text-gray-800 transition hover:bg-gray-50 active:scale-95"
          >
            {t.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
