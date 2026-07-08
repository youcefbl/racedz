"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { notifyHaptic } from "@/lib/native/haptics";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string | Date;
  readAt: string | Date | null;
};

// Optimistic notifications list: marking read flips the UI instantly, then the server
// action runs (and revalidates the header badge). If the action throws, the transition
// unwinds and the optimistic state is discarded automatically.
export function NotificationsList({ notifications, locale }: { notifications: NotificationItem[]; locale: Locale }) {
  const t = getDictionary(locale).notifications;
  const [, startTransition] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(notifications, (state, readId: string) =>
    readId === "*"
      ? state.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
      : state.map((n) => (n.id === readId ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n))
  );

  const unreadCount = optimistic.filter((n) => !n.readAt).length;

  function markOne(id: string) {
    startTransition(async () => {
      addOptimistic(id);
      notifyHaptic("success");
      await markNotificationReadAction(id);
    });
  }

  function markAll() {
    startTransition(async () => {
      addOptimistic("*");
      notifyHaptic("success");
      await markAllNotificationsReadAction();
    });
  }

  return (
    <>
      {unreadCount > 0 ? (
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={markAll}>
            {t.markAllRead.replace("{count}", String(unreadCount))}
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <ul className="divide-y divide-gray-200">
          {optimistic.map((notification) => (
            <li key={notification.id} className={notification.readAt ? "p-4" : "bg-teal-50/60 p-4"}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-2.5">
                  <span
                    className={notification.readAt ? "mt-1.5 size-2 shrink-0 rounded-full bg-transparent" : "mt-1.5 size-2 shrink-0 rounded-full bg-brand-orange"}
                    aria-label={notification.readAt ? undefined : t.unread}
                  />
                  <div className="min-w-0">
                    <h2 className={notification.readAt ? "text-sm font-semibold text-gray-700" : "text-sm font-black text-gray-950"}>
                      {notification.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{notification.body}</p>
                    <p className="mt-2 text-xs font-semibold text-gray-500">{formatDate(notification.createdAt, locale)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {notification.href ? (
                    <Link
                      href={notification.href}
                      onClick={() => {
                        // Opening a notification marks it read — so tapping through to the
                        // support chat (or anywhere) clears it instead of leaving it unread.
                        if (!notification.readAt) markOne(notification.id);
                      }}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 transition hover:border-brand-teal hover:text-brand-teal"
                    >
                      {t.open}
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {!notification.readAt ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => markOne(notification.id)}>
                      {t.markRead}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function formatDate(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
