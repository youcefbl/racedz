"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
export function NotificationsList({ notifications }: { notifications: NotificationItem[] }) {
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
            Mark all as read ({unreadCount})
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <ul className="divide-y divide-gray-200">
          {optimistic.map((notification) => (
            <li key={notification.id} className={notification.readAt ? "p-4" : "bg-teal-50/60 p-4"}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!notification.readAt ? <span className="size-2 rounded-full bg-brand-orange" aria-label="Unread" /> : null}
                    <h2 className="text-sm font-black text-gray-950">{notification.title}</h2>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{notification.body}</p>
                  <p className="mt-2 text-xs font-semibold text-gray-500">{formatDate(notification.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {notification.href ? (
                    <Link
                      href={notification.href}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 transition hover:border-brand-teal hover:text-brand-teal"
                    >
                      Open
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                  {!notification.readAt ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => markOne(notification.id)}>
                      Mark read
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

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
