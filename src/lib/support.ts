import "server-only";

import { getPrisma } from "@/lib/db";
import { notifyAdminsSupportMessage, notifyUserSupportReply } from "@/lib/notifications";

export const SUPPORT_MESSAGE_MAX = 4000;

export type SupportMessageView = {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
};

export type SupportThreadView = {
  id: string;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  lastMessageAt: string;
};

export type SupportUserView = {
  thread: SupportThreadView | null;
  messages: SupportMessageView[];
};

export type AdminSupportThreadRow = {
  id: string;
  status: "OPEN" | "CLOSED";
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
  lastMessage: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

/** Trim + bound a message body. Returns null when empty or too long. */
export function normalizeSupportBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.trim();
  if (body.length === 0 || body.length > SUPPORT_MESSAGE_MAX) return null;
  return body;
}

function toMessageView(message: {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: Date;
}): SupportMessageView {
  return {
    id: message.id,
    body: message.body,
    fromAdmin: message.fromAdmin,
    createdAt: message.createdAt.toISOString()
  };
}

function toThreadView(thread: {
  id: string;
  status: "OPEN" | "CLOSED";
  createdAt: Date;
  lastMessageAt: Date;
}): SupportThreadView {
  return {
    id: thread.id,
    status: thread.status,
    createdAt: thread.createdAt.toISOString(),
    lastMessageAt: thread.lastMessageAt.toISOString()
  };
}

/** The runner's single support thread, if one exists yet (created lazily on first message). */
async function findUserThread(userId: string) {
  return getPrisma().supportThread.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

/**
 * The runner's chat view: their thread (or null) plus its messages, oldest-first.
 * Marks the thread read for the user (they are looking at it now).
 */
export async function getUserSupportView(userId: string): Promise<SupportUserView> {
  const prisma = getPrisma();
  const thread = await findUserThread(userId);
  if (!thread) return { thread: null, messages: [] };

  const [messages] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" }
    }),
    prisma.supportThread.update({
      where: { id: thread.id },
      data: { userLastReadAt: new Date() }
    })
  ]);

  return { thread: toThreadView(thread), messages: messages.map(toMessageView) };
}

/** Count support replies the runner has not seen yet (for the account badge). */
export async function getUserSupportUnreadCount(userId: string): Promise<number> {
  const prisma = getPrisma();
  const thread = await findUserThread(userId);
  if (!thread) return 0;
  return prisma.supportMessage.count({
    where: {
      threadId: thread.id,
      fromAdmin: true,
      ...(thread.userLastReadAt ? { createdAt: { gt: thread.userLastReadAt } } : {})
    }
  });
}

/**
 * Append a runner message, creating (or reopening) the thread. Notifies the admin team.
 * The runner's own message counts as read for them, so userLastReadAt advances to now.
 */
export async function postUserSupportMessage(
  userId: string,
  body: string
): Promise<SupportUserView> {
  const prisma = getPrisma();
  const now = new Date();
  const existing = await findUserThread(userId);

  const thread = existing
    ? await prisma.supportThread.update({
        where: { id: existing.id },
        data: { status: "OPEN", lastMessageAt: now, userLastReadAt: now }
      })
    : await prisma.supportThread.create({
        data: { userId, lastMessageAt: now, userLastReadAt: now }
      });

  await prisma.supportMessage.create({
    data: { threadId: thread.id, authorId: userId, fromAdmin: false, body }
  });

  const runner = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true }
  });
  await notifyAdminsSupportMessage({
    threadId: thread.id,
    runnerName: runner ? `${runner.firstName} ${runner.lastName}`.trim() : "A runner",
    preview: body
  });

  return getUserSupportView(userId);
}

/**
 * Admin inbox: threads ordered by most-recent message first, with the runner, unread count, and
 * last message. An optional query filters by the runner's name or email.
 */
export async function getAdminSupportThreads(query?: string): Promise<AdminSupportThreadRow[]> {
  const prisma = getPrisma();
  const q = query?.trim();
  const threads = await prisma.supportThread.findMany({
    where: q
      ? {
          user: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } }
            ]
          }
        }
      : undefined,
    orderBy: { lastMessageAt: "desc" },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });

  // Unread-per-thread in one grouped query rather than N counts.
  const unreadRows = await prisma.$queryRaw<Array<{ threadId: string; count: bigint }>>`
    SELECT m."threadId" AS "threadId", COUNT(*) AS "count"
    FROM "SupportMessage" m
    INNER JOIN "SupportThread" t ON t."id" = m."threadId"
    WHERE m."fromAdmin" = false
      AND (t."adminLastReadAt" IS NULL OR m."createdAt" > t."adminLastReadAt")
    GROUP BY m."threadId"
  `;
  const unreadByThread = new Map(unreadRows.map((row) => [row.threadId, Number(row.count)]));

  return threads.map((thread) => ({
    id: thread.id,
    status: thread.status,
    lastMessageAt: thread.lastMessageAt.toISOString(),
    createdAt: thread.createdAt.toISOString(),
    unreadCount: unreadByThread.get(thread.id) ?? 0,
    lastMessage: thread.messages[0]?.body ?? null,
    user: {
      id: thread.user.id,
      name: `${thread.user.firstName} ${thread.user.lastName}`.trim(),
      email: thread.user.email,
      avatarUrl: thread.user.avatarUrl
    }
  }));
}

/** One thread for the admin view: messages + runner, marking it read for the admin. */
export async function getAdminSupportThread(threadId: string) {
  const prisma = getPrisma();
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } }
    }
  });
  if (!thread) return null;

  const [messages] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" }
    }),
    prisma.supportThread.update({
      where: { id: threadId },
      data: { adminLastReadAt: new Date() }
    })
  ]);

  return {
    thread: {
      ...toThreadView(thread),
      user: {
        id: thread.user.id,
        name: `${thread.user.firstName} ${thread.user.lastName}`.trim(),
        email: thread.user.email,
        avatarUrl: thread.user.avatarUrl
      }
    },
    messages: messages.map(toMessageView)
  };
}

/** Append an admin reply and notify the runner. Reopens the thread if it was closed. */
export async function postAdminSupportMessage(threadId: string, adminId: string, body: string) {
  const prisma = getPrisma();
  const now = new Date();
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    include: { user: { select: { id: true } } }
  });
  if (!thread) return null;

  await prisma.supportMessage.create({
    data: { threadId, authorId: adminId, fromAdmin: true, body }
  });
  await prisma.supportThread.update({
    where: { id: threadId },
    data: { status: "OPEN", lastMessageAt: now, adminLastReadAt: now }
  });

  await notifyUserSupportReply({ userId: thread.user.id, preview: body });

  return getAdminSupportThread(threadId);
}

export async function setSupportThreadStatus(threadId: string, status: "OPEN" | "CLOSED") {
  await getPrisma().supportThread.update({ where: { id: threadId }, data: { status } });
}

/** Number of threads with unseen runner messages, for the admin nav badge. */
export async function countAdminSupportUnreadThreads(): Promise<number> {
  const rows = await getPrisma().$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT m."threadId") AS "count"
    FROM "SupportMessage" m
    INNER JOIN "SupportThread" t ON t."id" = m."threadId"
    WHERE m."fromAdmin" = false
      AND (t."adminLastReadAt" IS NULL OR m."createdAt" > t."adminLastReadAt")
  `;
  return Number(rows[0]?.count ?? 0);
}
