"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Settings, UserRound, ClipboardList, ShieldCheck, Building2 } from "lucide-react";
import { useState } from "react";
import { signOutAction } from "@/components/layout/auth-actions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/race";

export type HeaderUser = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: UserRole;
};

export function AccountMenu({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(user.name);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex size-10 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white text-sm font-black text-gray-950 transition",
          "hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
        )}
      >
        {user.avatarUrl ? (
          <Image src={user.avatarUrl} alt="" width={40} height={40} className="size-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-soft">
          <div className="border-b border-gray-200 px-3 py-3">
            <p className="truncate text-sm font-black text-gray-950">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <div className="py-2">
            <MenuLink href="/account" icon={UserRound} label="Account overview" />
            <MenuLink href="/account/profile" icon={Settings} label="Profile settings" />
            <MenuLink href="/account/registrations" icon={ClipboardList} label="My registrations" />
            {user.role === "ORGANIZER" || user.role === "ADMIN" || user.role === "SUPERADMIN" ? (
              <MenuLink href="/organizer" icon={Building2} label="Organizer dashboard" />
            ) : null}
            {user.role === "ADMIN" || user.role === "SUPERADMIN" ? (
              <MenuLink href="/admin" icon={ShieldCheck} label="Admin dashboard" />
            ) : null}
          </div>
          <form action={signOutAction} className="border-t border-gray-200 pt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              <LogOut className="size-4 text-brand-orange" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: typeof UserRound;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-brand-teal"
    >
      <Icon className="size-4 text-brand-teal" aria-hidden="true" />
      {label}
    </Link>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "R";
  const second = parts[1]?.charAt(0) ?? "";

  return `${first}${second}`.toUpperCase();
}
