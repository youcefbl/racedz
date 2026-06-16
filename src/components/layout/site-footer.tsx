import Link from "next/link";
import { RaceDZLogo } from "@/components/layout/racedz-logo";

const links = [
  { href: "/races", label: "Races" },
  { href: "/organizer", label: "Organizers" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" }
];

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div className="space-y-3">
          <RaceDZLogo />
          <p className="max-w-md text-sm text-gray-500">
            Find, register, and manage races across Algeria.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600" aria-label="Footer navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-brand-teal">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
