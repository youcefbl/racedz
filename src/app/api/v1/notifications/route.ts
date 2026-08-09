import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markAllNotificationsRead,
} from "@/lib/notifications";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * The runner's notification inbox — race approvals, coach nudges, group activity, broadcasts.
 *
 * Reuses getUserNotifications so the app shows the same 50 rows in the same order the website's
 * `/account/notifications` does. `metadata` is deliberately NOT returned: it is an internal payload
 * the web pages read for their own rendering, and shipping it to a client that has no use for it
 * would make it a contract we then could not change.
 *
 * The unread count rides along with the list rather than being a second endpoint, because every
 * caller that wants one wants the other — the badge and the screen are the same fetch.
 */
export const GET = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-notifications", viewer.id), 120, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  const [rows, unreadCount] = await Promise.all([
    getUserNotifications(viewer.id) as Promise<NotificationRow[]>,
    getUnreadNotificationCount(viewer.id),
  ]);

  return apiOk(request, {
    unreadCount,
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

/** Marks everything read — the "clear all" the inbox offers. */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  const limited = enforceRateLimit(rateLimitKey("v1-notifications", viewer.id), 60, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Try again shortly."));

  await markAllNotificationsRead(viewer.id);
  return apiOk(request, { unreadCount: 0 });
});
