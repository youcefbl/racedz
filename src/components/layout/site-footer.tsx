"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ZidRunLogo } from "@/components/layout/racedz-logo";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";

export function SiteFooter() {
  const searchParams = useSearchParams();
  const locale = getLocale(searchParams.get("lang"));
  const dictionary = getDictionary(locale);
  const links = [
    { href: "/races", label: dictionary.nav.races },
    { href: "/organizers", label: dictionary.nav.organizers },
    { href: "/contact", label: dictionary.nav.contact },
    { href: "/terms", label: dictionary.nav.terms },
    { href: "/privacy", label: dictionary.nav.privacy }
  ];

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div className="space-y-3">
          <ZidRunLogo />
          <p className="max-w-md text-sm text-gray-500">{dictionary.pages.footerTagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600" aria-label="Footer navigation">
          {links.map((link) => (
            <Link key={link.href} href={withLocale(link.href, locale)} className="hover:text-brand-teal">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
