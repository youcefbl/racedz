import { Prisma, type BroadcastStatus } from "@prisma/client";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { createNotification, type NotificationChannel } from "@/lib/notifications";
import { renderRaceDzEmailHtml, renderRaceDzEmailText } from "@/lib/notifications/email-template";
import { buildPaginationMeta, parsePagination, type PaginatedResult, type PaginationParams } from "@/lib/pagination";

// Admin broadcast composer: translate an audience descriptor into a Prisma user
// filter, snapshot recipients, and drain them in resumable batches through the
// existing createNotification pipeline (per-user preference gating + 3 channels).

const BROADCAST_TYPE = "ADMIN_BROADCAST";
export const BROADCAST_CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "PUSH"];
export const DISPATCH_BATCH_SIZE = 50;

export const audienceSchema = z.object({
  roles: z.array(z.enum(["RUNNER", "ORGANIZER", "ADMIN", "SUPERADMIN"])).optional(),
  wilaya: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  hasRegistration: z.boolean().optional(),
  hasCoachSubscription: z.boolean().optional(),
  activeSinceDays: z.number().int().min(1).max(365).optional()
});
export type BroadcastAudience = z.infer<typeof audienceSchema>;

export const composeSchema = z.object({
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(3).max(4000),
  href: z.string().trim().max(500).optional(),
  channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH"])).min(1),
  audience: audienceSchema
});
export type ComposeInput = z.infer<typeof composeSchema>;

/** Build the Prisma user filter for a segment. Blocked users are always excluded. */
export function buildAudienceWhere(audience: BroadcastAudience): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { blockedAt: null };

  if (audience.roles && audience.roles.length > 0) {
    where.role = { in: audience.roles };
  }
  if (audience.wilaya) where.wilaya = audience.wilaya;
  if (audience.city) where.city = audience.city;
  if (audience.hasRegistration) where.registrations = { some: {} };
  if (audience.hasCoachSubscription) where.coachSubscriptions = { some: { status: "ACTIVE" } };
  if (audience.activeSinceDays) {
    where.lastLoginAt = { gte: new Date(Date.now() - audience.activeSinceDays * 86_400_000) };
  }

  return where;
}

/** Live recipient count for the compose preview. */
export function estimateAudience(audience: BroadcastAudience): Promise<number> {
  return getPrisma().user.count({ where: buildAudienceWhere(audience) });
}

export async function createBroadcastDraft(input: ComposeInput, createdById: string) {
  return getPrisma().broadcast.create({
    data: {
      title: input.title,
      body: input.body,
      href: input.href || null,
      channels: input.channels,
      audience: input.audience as Prisma.InputJsonValue,
      createdById
    }
  });
}

/**
 * Snapshot the segment into BroadcastRecipient rows and flip the broadcast to
 * SENDING. Idempotent: re-running skips already-inserted recipients.
 */
export async function startBroadcast(broadcastId: string): Promise<{ totalRecipients: number }> {
  const prisma = getPrisma();
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast) throw new Error("Broadcast not found.");
  if (broadcast.status === "SENT") return { totalRecipients: broadcast.totalRecipients };

  const audience = audienceSchema.parse(broadcast.audience);
  const users = await prisma.user.findMany({ where: buildAudienceWhere(audience), select: { id: true } });

  if (users.length > 0) {
    await prisma.broadcastRecipient.createMany({
      data: users.map((user) => ({ broadcastId, userId: user.id })),
      skipDuplicates: true
    });
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "SENDING", totalRecipients: users.length }
  });

  return { totalRecipients: users.length };
}

/**
 * Process one batch of PENDING recipients for a broadcast. Safe to call repeatedly
 * (inline kick or cron); marks the broadcast SENT once its queue is drained.
 */
export async function dispatchBroadcast(
  broadcastId: string,
  batchSize = DISPATCH_BATCH_SIZE
): Promise<{ processed: number; remaining: number }> {
  const prisma = getPrisma();
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!broadcast || broadcast.status === "SENT") return { processed: 0, remaining: 0 };

  const pending = await prisma.broadcastRecipient.findMany({
    where: { broadcastId, status: "PENDING" },
    take: batchSize
  });

  if (pending.length === 0) {
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: "SENT", sentAt: new Date() } });
    return { processed: 0, remaining: 0 };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: pending.map((r) => r.userId) } },
    select: { id: true, email: true }
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const channels = normalizeChannels(broadcast.channels);
  const absoluteHref = broadcast.href ? toAbsoluteUrl(broadcast.href) : undefined;

  let sent = 0;
  let failed = 0;
  for (const recipient of pending) {
    try {
      const to = emailById.get(recipient.userId);
      await createNotification({
        userId: recipient.userId,
        type: BROADCAST_TYPE,
        title: broadcast.title,
        body: broadcast.body,
        href: broadcast.href ?? undefined,
        channels,
        email:
          channels.includes("EMAIL") && to
            ? {
                to,
                subject: broadcast.title,
                html: renderRaceDzEmailHtml({
                  title: broadcast.title,
                  body: broadcast.body,
                  action: absoluteHref ? { label: "Open ZidRun", href: absoluteHref } : undefined
                }),
                text: renderRaceDzEmailText({
                  title: broadcast.title,
                  body: broadcast.body,
                  action: absoluteHref ? { label: "Open ZidRun", href: absoluteHref } : undefined
                })
              }
            : undefined
      });
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "SENT", sentAt: new Date() }
      });
      sent += 1;
    } catch (error) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 300) : "Unknown error" }
      });
      failed += 1;
    }
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { sentCount: { increment: sent }, failedCount: { increment: failed } }
  });

  const remaining = await prisma.broadcastRecipient.count({ where: { broadcastId, status: "PENDING" } });
  if (remaining === 0) {
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: "SENT", sentAt: new Date() } });
  }

  return { processed: pending.length, remaining };
}

/** Cron entry point: drain every SENDING broadcast up to a bounded number of batches. */
export async function dispatchPendingBroadcasts(maxBatches = 20): Promise<{ broadcasts: number; processed: number }> {
  const prisma = getPrisma();
  const sending = await prisma.broadcast.findMany({ where: { status: "SENDING" }, select: { id: true } });
  let processed = 0;
  let batches = 0;
  for (const broadcast of sending) {
    let remaining = 1;
    while (remaining > 0 && batches < maxBatches) {
      const result = await dispatchBroadcast(broadcast.id);
      processed += result.processed;
      remaining = result.remaining;
      batches += 1;
      if (result.processed === 0) break;
    }
  }
  return { broadcasts: sending.length, processed };
}

export type AdminBroadcastRow = {
  id: string;
  title: string;
  status: BroadcastStatus;
  channels: string[];
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  sentAt: Date | null;
};

export async function getAdminBroadcasts(pagination?: PaginationParams): Promise<PaginatedResult<AdminBroadcastRow>> {
  const prisma = getPrisma();
  const { page, limit, skip } = pagination ?? parsePagination();
  const [items, total] = await Promise.all([
    prisma.broadcast.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        channels: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        createdAt: true,
        sentAt: true
      }
    }),
    prisma.broadcast.count()
  ]);
  return { items, ...buildPaginationMeta(total, page, limit) };
}

function normalizeChannels(channels: string[]): NotificationChannel[] {
  const allowed = channels.filter((c): c is NotificationChannel => c === "IN_APP" || c === "EMAIL" || c === "PUSH");
  return allowed.length ? allowed : ["IN_APP"];
}

function toAbsoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  const base = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "https://zidrun.com";
  return new URL(href, base).toString();
}
