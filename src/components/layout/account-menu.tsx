"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, Settings, UserRound, ClipboardList, ShieldCheck, Building2, BrainCircuit } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/race";

export type HeaderUser = {
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: UserRole;
  unreadNotificationCount?: number;
  notifications?: HeaderNotification[];
};

export type HeaderNotification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function AccountMenu({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const initials = getInitials(user.name);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
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
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
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
        <div className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-soft" role="menu">
          <div className="border-b border-gray-200 px-3 py-3">
            <p className="truncate text-sm font-black text-gray-950">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <div className="py-2">
            <MenuLink href="/account" icon={UserRound} label="Account overview" onSelect={() => setOpen(false)} />
            <MenuLink href="/account/coach" icon={BrainCircuit} label="AI running coach" onSelect={() => setOpen(false)} />
            <MenuLink href="/account/profile" icon={Settings} label="Profile settings" onSelect={() => setOpen(false)} />
            <MenuLink href="/account/notification-settings" icon={Bell} label="Notification settings" onSelect={() => setOpen(false)} />
            <MenuLink href="/account/registrations" icon={ClipboardList} label="My registrations" onSelect={() => setOpen(false)} />
            {user.role === "RUNNER" ? (
              <MenuLink href="/organizer/request" icon={Building2} label="Request organizer access" onSelect={() => setOpen(false)} />
            ) : null}
            {user.role === "ORGANIZER" || user.role === "ADMIN" || user.role === "SUPERADMIN" ? (
              <MenuLink href="/organizer" icon={Building2} label="Organizer dashboard" onSelect={() => setOpen(false)} />
            ) : null}
            {user.role === "ADMIN" || user.role === "SUPERADMIN" ? (
              <MenuLink href="/admin" icon={ShieldCheck} label="Admin dashboard" onSelect={() => setOpen(false)} />
            ) : null}
          </div>
          <div className="border-t border-gray-200 pt-2">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => {
                setOpen(false);
                startSignOut(() => {
                  void signOut({ redirect: false, callbackUrl: "/login" }).then(() => {
                    router.refresh();
                    router.replace("/login");
                  });
                });
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="size-4 text-brand-orange" aria-hidden="true" />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onSelect
}: {
  href: string;
  icon: typeof UserRound;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
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
