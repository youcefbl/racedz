import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { getUnreadNotificationCount, markNotificationRead } from "@/lib/notifications";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Marks one notification read.
 *
 * Scoped to the caller inside markNotificationRead — the id alone is not authority to touch a row,
 * and the UPDATE carries the userId rather than trusting that a client only ever sends its own.
 *
 * Succeeds for an id that is already read or does not exist. A client retrying a mark-read it never
 * saw acknowledged should reach the state it asked for, not an error; and answering "no such
 * notification" differently from "not yours" would leak whether an id exists.
 *
 * Returns the fresh unread count so the badge updates from the server's number rather than the
 * client decrementing its own and drifting.
 */
export const POST = withApi(async (request, context: Context) => {
  const viewer = await requireMobileUser(request);
  const { id } = await context.params;

  const limited = enforceRateLimit(rateLimitKey("v1-notifications", viewer.id), 120, 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many requests. Please slow down."));

  await markNotificationRead(viewer.id, id);
  return apiOk(request, { unreadCount: await getUnreadNotificationCount(viewer.id) });
});
