import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { notifyRaceRegistrantsAnnouncement } from "@/lib/notifications";
import { raceAnnouncementSchema } from "@/lib/validations";

export type RaceAnnouncementRow = {
  id: string;
  raceEventId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  publishedAt: Date;
  createdAt: Date;
};

export class AnnouncementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnouncementError";
  }
}

export async function getRaceAnnouncements(raceEventId: string) {
  return getPrisma().$queryRaw<RaceAnnouncementRow[]>`
    SELECT
      announcement."id",
      announcement."raceEventId",
      announcement."authorId",
      CONCAT(author."firstName", ' ', author."lastName") AS "authorName",
      announcement."title",
      announcement."body",
      announcement."publishedAt",
      announcement."createdAt"
    FROM "RaceAnnouncement" announcement
    INNER JOIN "User" author ON author."id" = announcement."authorId"
    WHERE announcement."raceEventId" = ${raceEventId}
    ORDER BY announcement."publishedAt" DESC
  `;
}

export async function createOrganizerRaceAnnouncement({
  organizationId,
  authorId,
  input
}: {
  organizationId: string;
  authorId: string;
  input: unknown;
}) {
  const parsed = raceAnnouncementSchema.safeParse(input);

  if (!parsed.success) {
    throw new AnnouncementError("Write a title and announcement message.");
  }

  const race = await getPrisma().raceEvent.findFirst({
    where: {
      id: parsed.data.raceId,
      organizationId
    },
    select: {
      id: true,
      slug: true,
      title: true
    }
  });

  if (!race) {
    throw new AnnouncementError("Race not found for this organization.");
  }

  return createRaceAnnouncement({
    raceId: race.id,
    raceSlug: race.slug,
    raceTitle: race.title,
    authorId,
    title: parsed.data.title,
    body: parsed.data.body
  });
}

export async function createAdminRaceAnnouncement({
  authorId,
  input
}: {
  authorId: string;
  input: unknown;
}) {
  const parsed = raceAnnouncementSchema.safeParse(input);

  if (!parsed.success) {
    throw new AnnouncementError("Write a title and announcement message.");
  }

  const race = await getPrisma().raceEvent.findUnique({
    where: {
      id: parsed.data.raceId
    },
    select: {
      id: true,
      slug: true,
      title: true
    }
  });

  if (!race) {
    throw new AnnouncementError("Race not found.");
  }

  return createRaceAnnouncement({
    raceId: race.id,
    raceSlug: race.slug,
    raceTitle: race.title,
    authorId,
    title: parsed.data.title,
    body: parsed.data.body
  });
}

async function createRaceAnnouncement({
  raceId,
  raceSlug,
  raceTitle,
  authorId,
  title,
  body
}: {
  raceId: string;
  raceSlug: string;
  raceTitle: string;
  authorId: string;
  title: string;
  body: string;
}) {
  const rows = await getPrisma().$queryRaw<RaceAnnouncementRow[]>`
    INSERT INTO "RaceAnnouncement" (
      "id",
      "raceEventId",
      "authorId",
      "title",
      "body",
      "publishedAt"
    )
    VALUES (
      ${randomUUID()},
      ${raceId},
      ${authorId},
      ${title},
      ${body},
      NOW()
    )
    RETURNING
      "id",
      "raceEventId",
      "authorId",
      '' AS "authorName",
      "title",
      "body",
      "publishedAt",
      "createdAt"
  `;
  const announcement = rows[0];

  await notifyRaceRegistrantsAnnouncement({
    raceId,
    raceSlug,
    raceTitle,
    announcementTitle: title,
    announcementBody: body
  });

  return announcement;
}
