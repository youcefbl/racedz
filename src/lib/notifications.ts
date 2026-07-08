import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/notifications/email-provider";
import { renderRaceDzEmailHtml, renderRaceDzEmailText } from "@/lib/notifications/email-template";
import { sendFirebasePush } from "@/lib/notifications/firebase-provider";

export type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH";

export type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
};

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  metadata?: Record<string, unknown>;
  channels?: NotificationChannel[];
  email?: {
    to: string;
    subject?: string;
    html?: string;
    text?: string;
  };
};

type NotificationRecipient = {
  id: string;
  email: string;
};

type RaceRegistrantRecipient = NotificationRecipient & {
  firstName: string;
  lastName: string;
};

export const notificationPreferenceOptions = [
  {
    type: "ADMIN_BROADCAST",
    title: "ZidRun announcements",
    description: "Product updates, new races, and news from the ZidRun team."
  },
  {
    type: "RACE_APPROVAL_PENDING",
    title: "Race approval pending",
    description: "Admins are notified when an organizer submits a race for review."
  },
  {
    type: "ORGANIZER_RACE_APPROVED",
    title: "Race approved",
    description: "Organizers are notified when an admin publishes their race."
  },
  {
    type: "ORGANIZER_RACE_REJECTED",
    title: "Race rejected",
    description: "Organizers are notified when an admin rejects their race."
  },
  {
    type: "ORGANIZER_RACE_UNPUBLISHED",
    title: "Race unpublished",
    description: "Organizers are notified when an admin removes their race from public listings."
  },
  {
    type: "PAYMENT_PROOF_REVIEW",
    title: "Payment proof review",
    description: "Organizers are notified when a payment proof needs manual review."
  },
  {
    type: "RACE_REMINDER",
    title: "Race reminders",
    description: "Runners are notified before registered race dates."
  },
  {
    type: "WILAYA_RACE_ALERT",
    title: "New race nearby",
    description: "Runners are notified when a race opens in their wilaya."
  },
  {
    type: "ORGANIZER_ANNOUNCEMENT",
    title: "Organizer announcements",
    description: "Runners receive updates from race organizers."
  },
  {
    type: "RACE_CHANGE",
    title: "Race changes",
    description: "Runners are notified when a race date, location, category, price, or status changes."
  },
  {
    type: "RACE_REGISTRATION_CREATED",
    title: "Race registration",
    description: "Runners are notified when their race registration is created."
  },
  {
    type: "RACE_ANNOUNCEMENT",
    title: "Race announcements",
    description: "Runners receive organizer or admin announcements for races they registered for."
  },
  {
    type: "RUNNER_INACTIVITY_NUDGE",
    title: "Coach activity reminders",
    description: "The AI coach reminds you to keep moving when you haven't logged a run in a while."
  },
  {
    type: "TRAINING_REMINDER",
    title: "Daily training reminders",
    description: "A morning reminder on days your plan has a run — with the target, weather, and fuelling tips."
  },
  {
    type: "TRAINING_PLAN_READY",
    title: "New training week ready",
    description: "We let you know when your next week's plan is generated automatically."
  }
] as const;

export type NotificationPreferenceType = (typeof notificationPreferenceOptions)[number]["type"];

export type NotificationPreferenceRow = {
  type: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

export async function createNotification(input: CreateNotificationInput) {
  const channels = input.channels ?? ["IN_APP"];
  const metadataJson = JSON.stringify(input.metadata ?? {});
  const rows = await getPrisma().$queryRaw<NotificationRow[]>`
    INSERT INTO "Notification" (
      "id",
      "userId",
      "type",
      "title",
      "body",
      "href",
      "metadata"
    )
    VALUES (
      ${randomUUID()},
      ${input.userId},
      ${input.type},
      ${input.title},
      ${input.body},
      ${input.href ?? null},
      ${metadataJson}::jsonb
    )
    RETURNING "id", "userId", "type", "title", "body", "href", "metadata", "readAt", "createdAt"
  `;
  const notification = rows[0];

  if (!notification) {
    throw new Error("Failed to create notification.");
  }

  if (channels.includes("EMAIL") && input.email) {
    if (await isNotificationChannelEnabled(input.userId, input.type, "email")) {
      await deliverEmail(notification.id, {
        to: input.email.to,
        subject: input.email.subject ?? input.title,
        html: input.email.html ?? renderEmailHtml({ title: input.title, body: input.body, href: input.href }),
        text: input.email.text ?? renderEmailText({ title: input.title, body: input.body, href: input.href })
      });
    } else {
      await createSkippedDelivery(notification.id, "EMAIL", "resend", "Email disabled by user preference.");
    }
  }

  if (channels.includes("PUSH")) {
    if (await isNotificationChannelEnabled(input.userId, input.type, "push")) {
      await deliverPush(notification);
    } else {
      await createSkippedDelivery(notification.id, "PUSH", "firebase", "Push disabled by user preference.");
    }
  }

  return notification;
}

export async function getNotificationPreferences(userId: string) {
  const rows = await getPrisma().$queryRaw<NotificationPreferenceRow[]>`
    SELECT
      "type",
      "inAppEnabled",
      "pushEnabled",
      "emailEnabled"
    FROM "NotificationPreference"
    WHERE "userId" = ${userId}
  `;
  const rowByType = new Map(rows.map((row) => [row.type, row]));

  return notificationPreferenceOptions.map((option) => ({
    ...option,
    inAppEnabled: rowByType.get(option.type)?.inAppEnabled ?? true,
    pushEnabled: rowByType.get(option.type)?.pushEnabled ?? true,
    emailEnabled: rowByType.get(option.type)?.emailEnabled ?? true
  }));
}

export async function updateNotificationPreferences({
  userId,
  preferences
}: {
  userId: string;
  preferences: NotificationPreferenceRow[];
}) {
  for (const preference of preferences) {
    await getPrisma().$executeRaw`
      INSERT INTO "NotificationPreference" (
        "id",
        "userId",
        "type",
        "inAppEnabled",
        "pushEnabled",
        "emailEnabled",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${userId},
        ${preference.type},
        ${preference.inAppEnabled},
        ${preference.pushEnabled},
        ${preference.emailEnabled},
        NOW()
      )
      ON CONFLICT ("userId", "type")
      DO UPDATE SET
        "inAppEnabled" = EXCLUDED."inAppEnabled",
        "pushEnabled" = EXCLUDED."pushEnabled",
        "emailEnabled" = EXCLUDED."emailEnabled",
        "updatedAt" = NOW()
    `;
  }
}

export async function upsertPushSubscription({
  userId,
  token,
  deviceLabel
}: {
  userId: string;
  token: string;
  deviceLabel?: string;
}) {
  await getPrisma().$executeRaw`
    INSERT INTO "PushSubscription" (
      "id",
      "userId",
      "provider",
      "token",
      "deviceLabel",
      "lastSeenAt",
      "revokedAt"
    )
    VALUES (
      ${randomUUID()},
      ${userId},
      'firebase',
      ${token},
      ${deviceLabel ?? null},
      NOW(),
      NULL
    )
    ON CONFLICT ("token")
    DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "deviceLabel" = EXCLUDED."deviceLabel",
      "lastSeenAt" = NOW(),
      "revokedAt" = NULL
  `;
}

export async function revokePushSubscription({ userId, token }: { userId: string; token: string }) {
  await getPrisma().$executeRaw`
    UPDATE "PushSubscription"
    SET "revokedAt" = NOW()
    WHERE "userId" = ${userId}
      AND "token" = ${token}
  `;
}

export async function getUnreadNotificationCount(userId: string) {
  const rows = await getPrisma().$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS "count"
    FROM "Notification"
    WHERE "userId" = ${userId}
      AND "readAt" IS NULL
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function getUserNotifications(userId: string) {
  return getPrisma().$queryRaw<NotificationRow[]>`
    SELECT "id", "userId", "type", "title", "body", "href", "metadata", "readAt", "createdAt"
    FROM "Notification"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;
}

export async function getHeaderNotifications(userId: string) {
  return getPrisma().$queryRaw<NotificationRow[]>`
    SELECT "id", "userId", "type", "title", "body", "href", "metadata", "readAt", "createdAt"
    FROM "Notification"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
    LIMIT 6
  `;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await getPrisma().$executeRaw`
    UPDATE "Notification"
    SET "readAt" = COALESCE("readAt", NOW())
    WHERE "id" = ${notificationId}
      AND "userId" = ${userId}
  `;
}

export async function markAllNotificationsRead(userId: string) {
  await getPrisma().$executeRaw`
    UPDATE "Notification"
    SET "readAt" = COALESCE("readAt", NOW())
    WHERE "userId" = ${userId}
      AND "readAt" IS NULL
  `;
}

export async function notifyAdminsRacePendingReview({
  raceId,
  raceTitle,
  organizationName
}: {
  raceId: string;
  raceTitle: string;
  organizationName: string;
}) {
  const admins = await getPrisma().user.findMany({
    where: {
      role: {
        in: ["ADMIN", "SUPERADMIN"]
      }
    },
    select: {
      id: true,
      email: true
    }
  });

  await notifyRecipients(admins, {
    type: "RACE_APPROVAL_PENDING",
    title: "Race approval pending",
    body: `${organizationName} submitted "${raceTitle}" for review.`,
    href: "/admin/races?status=PENDING_REVIEW",
    metadata: {
      raceId
    },
    channels: ["IN_APP", "EMAIL", "PUSH"]
  });
}

export async function notifyOrganizerRaceStatusChanged({
  raceId,
  raceTitle,
  status
}: {
  raceId: string;
  raceTitle: string;
  status: "PUBLISHED" | "REJECTED" | "UNPUBLISHED";
}) {
  const recipients = await getPrisma().$queryRaw<NotificationRecipient[]>`
    SELECT DISTINCT users."id", users."email"
    FROM "RaceEvent" race
    INNER JOIN "OrganizationMember" member ON member."organizationId" = race."organizationId"
    INNER JOIN "User" users ON users."id" = member."userId"
    WHERE race."id" = ${raceId}
  `;

  if (recipients.length === 0) {
    return;
  }

  const published = status === "PUBLISHED";
  const rejected = status === "REJECTED";
  await notifyRecipients(recipients, {
    type: published ? "ORGANIZER_RACE_APPROVED" : rejected ? "ORGANIZER_RACE_REJECTED" : "ORGANIZER_RACE_UNPUBLISHED",
    title: published ? "Race published" : rejected ? "Race rejected" : "Race unpublished",
    body: published
      ? `"${raceTitle}" is now published on ZidRun.`
      : rejected
        ? `"${raceTitle}" was rejected by the ZidRun admin team.`
        : `"${raceTitle}" was unpublished by the ZidRun admin team.`,
    href: `/organizer/events/${raceId}`,
    metadata: {
      raceId,
      status
    },
    channels: ["IN_APP", "EMAIL", "PUSH"]
  });
}

export async function notifyRaceRegistrationCreated({
  userId,
  email,
  raceId,
  raceSlug,
  raceTitle,
  categoryName
}: {
  userId: string;
  email: string;
  raceId: string;
  raceSlug: string;
  raceTitle: string;
  categoryName: string;
}) {
  const href = `/account/registrations`;
  const body = `Your registration for "${raceTitle}" (${categoryName}) was created.`;
  const url = new URL(href, getAppUrl()).toString();

  await createNotification({
    userId,
    type: "RACE_REGISTRATION_CREATED",
    title: "Race registration received",
    body,
    href,
    metadata: {
      raceId,
      raceSlug,
      categoryName
    },
    channels: ["IN_APP", "EMAIL", "PUSH"],
    email: {
      to: email,
      subject: `Registration received: ${raceTitle}`,
      html: renderRaceDzEmailHtml({
        preheader: `Your ZidRun registration for ${raceTitle} was created.`,
        title: "Registration received",
        body,
        action: {
          label: "View registration",
          href: url
        },
        meta: [
          { label: "Race", value: raceTitle },
          { label: "Category", value: categoryName }
        ]
      }),
      text: renderRaceDzEmailText({
        title: "Registration received",
        body,
        action: {
          label: "View registration",
          href: url
        },
        meta: [
          { label: "Race", value: raceTitle },
          { label: "Category", value: categoryName }
        ]
      })
    }
  });
}

export async function notifyRaceRegistrantsRaceChanged({
  raceId,
  raceSlug,
  raceTitle,
  summary,
  changes
}: {
  raceId: string;
  raceSlug: string;
  raceTitle: string;
  summary: string;
  changes: string[];
}) {
  const recipients = await getRaceRegistrantRecipients(raceId);

  if (recipients.length === 0) {
    return;
  }

  const href = `/races/${raceSlug}`;
  const url = new URL(href, getAppUrl()).toString();

  await notifyRecipients(recipients, {
    type: "RACE_CHANGE",
    title: "Race details updated",
    body: summary,
    href,
    metadata: {
      raceId,
      changes
    },
    channels: ["IN_APP", "EMAIL", "PUSH"],
    emailTemplate: {
      subject: `Race update: ${raceTitle}`,
      title: "Race details updated",
      body: summary,
      action: {
        label: "View race",
        href: url
      },
      meta: [
        { label: "Race", value: raceTitle },
        { label: "Changes", value: changes.join(", ") || "Details updated" }
      ]
    }
  });
}

export async function notifyRaceRegistrantsAnnouncement({
  raceId,
  raceSlug,
  raceTitle,
  announcementTitle,
  announcementBody
}: {
  raceId: string;
  raceSlug: string;
  raceTitle: string;
  announcementTitle: string;
  announcementBody: string;
}) {
  const recipients = await getRaceRegistrantRecipients(raceId);

  if (recipients.length === 0) {
    return;
  }

  const href = `/races/${raceSlug}`;
  const url = new URL(href, getAppUrl()).toString();

  await notifyRecipients(recipients, {
    type: "RACE_ANNOUNCEMENT",
    title: announcementTitle,
    body: announcementBody,
    href,
    metadata: {
      raceId
    },
    channels: ["IN_APP", "EMAIL", "PUSH"],
    emailTemplate: {
      subject: `${raceTitle}: ${announcementTitle}`,
      title: announcementTitle,
      body: announcementBody,
      action: {
        label: "View race",
        href: url
      },
      meta: [
        {
          label: "Race",
          value: raceTitle
        }
      ]
    }
  });
}

async function notifyRecipients(
  recipients: NotificationRecipient[],
  input: Omit<CreateNotificationInput, "userId" | "email"> & {
    channels: NotificationChannel[];
    emailTemplate?: {
      subject: string;
      title: string;
      body: string;
      action?: {
        label: string;
        href: string;
      };
      meta?: Array<{
        label: string;
        value: string;
      }>;
    };
  }
) {
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        ...input,
        userId: recipient.id,
        email: input.channels.includes("EMAIL")
          ? input.emailTemplate
            ? {
                to: recipient.email,
                subject: input.emailTemplate.subject,
                html: renderRaceDzEmailHtml(input.emailTemplate),
                text: renderRaceDzEmailText(input.emailTemplate)
              }
            : {
                to: recipient.email
              }
          : undefined
      })
    )
  );
}

async function getRaceRegistrantRecipients(raceId: string) {
  return getPrisma().$queryRaw<RaceRegistrantRecipient[]>`
    SELECT DISTINCT users."id", users."email", users."firstName", users."lastName"
    FROM "RaceRegistration" registration
    INNER JOIN "User" users ON users."id" = registration."userId"
    WHERE registration."raceEventId" = ${raceId}
      AND registration."status" NOT IN ('CANCELLED', 'REJECTED')
  `;
}

async function deliverEmail(notificationId: string, email: NonNullable<CreateNotificationInput["email"]>) {
  const deliveryId = randomUUID();

  await getPrisma().$executeRaw`
    INSERT INTO "NotificationDelivery" (
      "id",
      "notificationId",
      "channel",
      "status",
      "provider"
    )
    VALUES (
      ${deliveryId},
      ${notificationId},
      'EMAIL',
      'PENDING',
      'resend'
    )
  `;

  const result = await sendNotificationEmail({
    to: email.to,
    subject: email.subject ?? "ZidRun notification",
    html: email.html ?? "",
    text: email.text
  });

  if (result.ok) {
    await getPrisma().$executeRaw`
      UPDATE "NotificationDelivery"
      SET
        "status" = 'SENT',
        "providerMessageId" = ${result.providerMessageId},
        "sentAt" = NOW()
      WHERE "id" = ${deliveryId}
    `;
    return;
  }

  await getPrisma().$executeRaw`
    UPDATE "NotificationDelivery"
    SET
      "status" = 'FAILED',
      "error" = ${result.error}
    WHERE "id" = ${deliveryId}
  `;
}

async function deliverPush(notification: NotificationRow) {
  const subscriptions = await getPrisma().$queryRaw<Array<{ id: string; token: string }>>`
    SELECT "id", "token"
    FROM "PushSubscription"
    WHERE "userId" = ${notification.userId}
      AND "provider" = 'firebase'
      AND "revokedAt" IS NULL
  `;

  if (subscriptions.length === 0) {
    await createSkippedDelivery(notification.id, "PUSH", "firebase", "No active push subscription.");
    return;
  }

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const deliveryId = randomUUID();

      await getPrisma().$executeRaw`
        INSERT INTO "NotificationDelivery" (
          "id",
          "notificationId",
          "channel",
          "status",
          "provider"
        )
        VALUES (
          ${deliveryId},
          ${notification.id},
          'PUSH',
          'PENDING',
          'firebase'
        )
      `;

      const result = await sendFirebasePush({
        token: subscription.token,
        title: notification.title,
        body: notification.body,
        href: notification.href ?? undefined
      });

      if (result.ok) {
        await getPrisma().$executeRaw`
          UPDATE "NotificationDelivery"
          SET
            "status" = 'SENT',
            "providerMessageId" = ${result.providerMessageId},
            "sentAt" = NOW()
          WHERE "id" = ${deliveryId}
        `;
        return;
      }

      await getPrisma().$executeRaw`
        UPDATE "NotificationDelivery"
        SET
          "status" = 'FAILED',
          "error" = ${result.error}
        WHERE "id" = ${deliveryId}
      `;

      if (result.shouldRevokeToken) {
        await getPrisma().$executeRaw`
          UPDATE "PushSubscription"
          SET "revokedAt" = NOW()
          WHERE "id" = ${subscription.id}
        `;
      }
    })
  );
}

async function createSkippedDelivery(notificationId: string, channel: NotificationChannel, provider: string, reason: string) {
  await getPrisma().$executeRaw`
    INSERT INTO "NotificationDelivery" (
      "id",
      "notificationId",
      "channel",
      "status",
      "provider",
      "error"
    )
    VALUES (
      ${randomUUID()},
      ${notificationId},
      ${channel},
      'SKIPPED',
      ${provider},
      ${reason}
    )
  `;
}

function renderEmailHtml({ title, body, href }: { title: string; body: string; href?: string }) {
  const url = href ? new URL(href, getAppUrl()).toString() : null;

  return renderRaceDzEmailHtml({
    title,
    body,
    action: url
      ? {
          label: "Open ZidRun",
          href: url
        }
      : undefined
  });
}

async function isNotificationChannelEnabled(userId: string, type: string, channel: "email" | "push") {
  const column = channel === "email" ? "emailEnabled" : "pushEnabled";
  const rows =
    column === "emailEnabled"
      ? await getPrisma().$queryRaw<Array<{ enabled: boolean }>>`
          SELECT "emailEnabled" AS "enabled"
          FROM "NotificationPreference"
          WHERE "userId" = ${userId}
            AND "type" = ${type}
          LIMIT 1
        `
      : await getPrisma().$queryRaw<Array<{ enabled: boolean }>>`
          SELECT "pushEnabled" AS "enabled"
          FROM "NotificationPreference"
          WHERE "userId" = ${userId}
            AND "type" = ${type}
          LIMIT 1
        `;

  return rows[0]?.enabled ?? true;
}

function renderEmailText({ title, body, href }: { title: string; body: string; href?: string }) {
  const url = href ? new URL(href, getAppUrl()).toString() : null;

  return renderRaceDzEmailText({
    title,
    body,
    action: url
      ? {
          label: "Open ZidRun",
          href: url
        }
      : undefined
  });
}

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003";
}
