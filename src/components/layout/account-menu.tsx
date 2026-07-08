"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, Settings, UserRound, ClipboardList, ShieldCheck, Building2, BrainCircuit, CreditCard } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useMenuKeyboard } from "@/components/layout/use-menu-keyboard";
import { toast } from "@/components/ui/toast";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";
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

export function AccountMenu({ user, locale = "en" }: { user: HeaderUser; locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { onKeyDown } = useMenuKeyboard({ open, setOpen, menuRef, triggerRef });
  const pathname = usePathname();
  const t = getDictionary(locale).account;
  const initials = getInitials(user.name);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Reset the two-step sign-out confirm whenever the menu closes.
  useEffect(() => {
    if (!open) setConfirmingSignOut(false);
  }, [open]);

  function handleSignOut() {
    if (!confirmingSignOut) {
      setConfirmingSignOut(true);
      return;
    }
    startSignOut(() => {
      void signOut({ redirect: false })
        .then(() => {
          // Full navigation so the server-rendered header (in the root layout, which
          // client navigation doesn't re-render) resets to the logged-out state.
          window.location.assign(withLocale("/login", locale));
        })
        .catch(() => {
          toast(t.signOutError, "error");
          setConfirmingSignOut(false);
        });
    });
  }

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
        ref={triggerRef}
        type="button"
        aria-label={t.menuLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex size-11 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white text-sm font-black text-gray-950 transition",
          "hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
        )}
      >
        {user.avatarUrl ? (
          <Image src={user.avatarUrl} alt="" width={40} height={40} className="size-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </button>

      {open ? <div className="rz-pop-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <div className="rz-pop absolute end-0 top-12 z-50 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-soft" role="menu" aria-label={t.menuLabel} onKeyDown={onKeyDown}>
          <div className="border-b border-gray-200 px-3 py-3">
            <p className="truncate text-sm font-black text-gray-950">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
          <div className="py-2">
            <MenuLink href={withLocale("/account", locale)} icon={UserRound} label={t.accountOverview} onSelect={() => setOpen(false)} />
            <MenuLink href={withLocale("/account/coach", locale)} icon={BrainCircuit} label={t.coach} onSelect={() => setOpen(false)} />
            <MenuLink href={withLocale("/account/profile", locale)} icon={Settings} label={t.profileSettings} onSelect={() => setOpen(false)} />
            <MenuLink href={withLocale("/account/coach/subscribe", locale)} icon={CreditCard} label={t.coachSubscription} onSelect={() => setOpen(false)} />
            <MenuLink href={withLocale("/account/notification-settings", locale)} icon={Bell} label={t.notificationSettings} onSelect={() => setOpen(false)} />
            <MenuLink href={withLocale("/account/registrations", locale)} icon={ClipboardList} label={t.myRegistrations} onSelect={() => setOpen(false)} />
            {user.role === "RUNNER" ? (
              <MenuLink href={withLocale("/organizer/request", locale)} icon={Building2} label={t.requestOrganizer} onSelect={() => setOpen(false)} />
            ) : null}
            {user.role === "ORGANIZER" || user.role === "ADMIN" || user.role === "SUPERADMIN" ? (
              <MenuLink href={withLocale("/organizer", locale)} icon={Building2} label={t.organizerDashboard} onSelect={() => setOpen(false)} />
            ) : null}
            {user.role === "ADMIN" || user.role === "SUPERADMIN" ? (
              <MenuLink href={withLocale("/admin", locale)} icon={ShieldCheck} label={t.adminDashboard} onSelect={() => setOpen(false)} />
            ) : null}
          </div>
          <div className="border-t border-gray-200 pt-2">
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                confirmingSignOut ? "bg-red-50 text-red-700 hover:bg-red-100" : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <LogOut className={cn("size-4", confirmingSignOut ? "text-red-600" : "text-brand-orange")} aria-hidden="true" />
              {signingOut ? t.signingOut : confirmingSignOut ? t.confirmSignOut : t.signOut}
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
