import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("racedz-demo-password", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@racedz.dz" },
    update: {},
    create: {
      email: "admin@racedz.dz",
      passwordHash,
      firstName: "RaceDZ",
      lastName: "Admin",
      arabicFullName: "إدارة رايس ديزاد",
      role: "SUPERADMIN"
    }
  });

  const organizerUser = await prisma.user.upsert({
    where: { email: "organizer@racedz.dz" },
    update: {},
    create: {
      email: "organizer@racedz.dz",
      passwordHash,
      firstName: "Amina",
      lastName: "Mansouri",
      arabicFullName: "أمينة منصوري",
      role: "ORGANIZER",
      nationalId: "ORG-DEMO-001",
      avatarUrl: "/racedz-logo.png",
      wilaya: "Alger",
      city: "Alger Centre",
      commune: "Alger Centre"
    }
  });

  const runner = await prisma.user.upsert({
    where: { email: "runner@example.com" },
    update: {},
    create: {
      email: "runner@example.com",
      passwordHash,
      firstName: "Karim",
      lastName: "Belaid",
      arabicFullName: "كريم بلعيد",
      role: "RUNNER",
      nationalId: "RUN-DEMO-001",
      avatarUrl: "/racedz-logo.png",
      wilaya: "Oran",
      city: "Oran",
      commune: "Oran"
    }
  });

  const algerClub = await prisma.organization.upsert({
    where: { slug: "alger-running-club" },
    update: {},
    create: {
      name: "Alger Running Club",
      slug: "alger-running-club",
      description: "Community road running organizer in Alger.",
      email: "club@racedz.dz",
      wilaya: "Alger",
      city: "Alger Centre",
      commune: "Alger Centre",
      status: "APPROVED",
      members: {
        create: {
          userId: organizerUser.id,
          role: "OWNER"
        }
      }
    }
  });

  const oranTeam = await prisma.organization.upsert({
    where: { slug: "oran-trail-team" },
    update: {},
    create: {
      name: "Oran Trail Team",
      slug: "oran-trail-team",
      description: "Trail and road race organizer based in Oran.",
      email: "oran@racedz.dz",
      wilaya: "Oran",
      city: "Oran",
      commune: "Oran",
      status: "APPROVED"
    }
  });

  const kabylieRunners = await prisma.organization.upsert({
    where: { slug: "kabylie-mountain-runners" },
    update: {},
    create: {
      name: "Kabylie Mountain Runners",
      slug: "kabylie-mountain-runners",
      description: "Mountain running and trail events in Kabylie.",
      email: "trail@racedz.dz",
      wilaya: "Tizi Ouzou",
      city: "Tizi Ouzou",
      commune: "Tizi Ouzou",
      status: "APPROVED"
    }
  });

  const alger10k = await prisma.raceEvent.upsert({
    where: { slug: "alger-10k" },
    update: {},
    create: {
      organizationId: algerClub.id,
      source: "ORGANIZATION",
      title: "Alger 10K",
      slug: "alger-10k",
      description: "A fast road race through central Alger.",
      raceType: "TEN_K",
      status: "PUBLISHED",
      registrationStatus: "OPEN",
      startDate: new Date("2026-10-02T08:00:00.000Z"),
      registrationOpenAt: new Date("2026-06-01T08:00:00.000Z"),
      registrationCloseAt: new Date("2026-09-25T22:59:00.000Z"),
      wilaya: "Alger",
      city: "Alger Centre",
      commune: "Alger Centre",
      address: "Place des Martyrs, Alger",
      mainImageUrl: "/racedz-logo.png",
      organizerName: "Alger Running Club",
      organizerUrl: "https://racedz.dz/organizations/alger-running-club",
      maxParticipants: 1500,
      availablePlaces: 1320,
      categories: {
        create: [
          { name: "5K Community Run", distanceKm: 5, priceDzd: 1000 },
          { name: "10K Open", distanceKm: 10, priceDzd: 1800 }
        ]
      }
    }
  });

  await prisma.raceEvent.upsert({
    where: { slug: "oran-half-marathon" },
    update: {},
    create: {
      organizationId: oranTeam.id,
      source: "ORGANIZATION",
      title: "Oran Half Marathon",
      slug: "oran-half-marathon",
      description: "A coastal half marathon route connecting Oran landmarks.",
      raceType: "HALF_MARATHON",
      status: "PUBLISHED",
      registrationStatus: "OPEN",
      startDate: new Date("2026-11-14T07:30:00.000Z"),
      registrationOpenAt: new Date("2026-07-01T08:00:00.000Z"),
      registrationCloseAt: new Date("2026-11-01T22:59:00.000Z"),
      wilaya: "Oran",
      city: "Oran",
      commune: "Oran",
      address: "Front de mer, Oran",
      mainImageUrl: "/racedz-logo.png",
      organizerName: "Oran Trail Team",
      organizerUrl: "https://racedz.dz/organizations/oran-trail-team",
      maxParticipants: 2200,
      availablePlaces: 2040,
      categories: {
        create: [
          { name: "10K", distanceKm: 10, priceDzd: 1600 },
          { name: "21K Half Marathon", distanceKm: 21.1, priceDzd: 2800 }
        ]
      }
    }
  });

  await prisma.raceEvent.upsert({
    where: { slug: "tizi-ouzou-trail-challenge" },
    update: {},
    create: {
      organizationId: kabylieRunners.id,
      source: "ORGANIZATION",
      title: "Tizi Ouzou Trail Challenge",
      slug: "tizi-ouzou-trail-challenge",
      description: "A mountain trail event in Kabylie with technical climbs and aid stations.",
      raceType: "TRAIL",
      status: "PUBLISHED",
      registrationStatus: "OPEN",
      startDate: new Date("2026-12-05T06:30:00.000Z"),
      registrationOpenAt: new Date("2026-08-01T08:00:00.000Z"),
      registrationCloseAt: new Date("2026-11-20T22:59:00.000Z"),
      wilaya: "Tizi Ouzou",
      city: "Tizi Ouzou",
      commune: "Tizi Ouzou",
      address: "Maison de la culture Mouloud Mammeri",
      mainImageUrl: "/racedz-logo.png",
      organizerName: "Kabylie Mountain Runners",
      organizerUrl: "https://racedz.dz/organizations/kabylie-mountain-runners",
      maxParticipants: 700,
      availablePlaces: 580,
      categories: {
        create: [
          { name: "Trail 25K", distanceKm: 25, elevationGainM: 1250, priceDzd: 3200, cutoffTimeMin: 360 },
          { name: "Trail 50K", distanceKm: 50, elevationGainM: 2600, priceDzd: 5200, cutoffTimeMin: 720 }
        ]
      }
    }
  });

  await prisma.raceEvent.upsert({
    where: { slug: "constantine-city-run" },
    update: {},
    create: {
      source: "PLATFORM",
      title: "Constantine City Run",
      slug: "constantine-city-run",
      description: "A platform-created community road race crossing Constantine's iconic bridges.",
      raceType: "ROAD",
      status: "PUBLISHED",
      registrationStatus: "NOT_OPEN",
      startDate: new Date("2027-01-23T08:00:00.000Z"),
      registrationOpenAt: new Date("2026-09-01T08:00:00.000Z"),
      registrationCloseAt: new Date("2027-01-10T22:59:00.000Z"),
      wilaya: "Constantine",
      city: "Constantine",
      commune: "Constantine",
      address: "Centre-ville, Constantine",
      mainImageUrl: "/racedz-logo.png",
      organizerName: "RaceDZ Community Desk",
      organizerUrl: "https://racedz.dz",
      contactEmail: "events@racedz.dz",
      maxParticipants: 1200,
      availablePlaces: 1200,
      categories: {
        create: [
          { name: "5K Family Run", distanceKm: 5, priceDzd: 800 },
          { name: "10K", distanceKm: 10, priceDzd: 1500 }
        ]
      }
    }
  });

  const category = await prisma.raceCategory.findFirstOrThrow({
    where: {
      raceEventId: alger10k.id,
      name: "10K Open"
    }
  });

  await prisma.raceRegistration.upsert({
    where: {
      userId_raceCategoryId: {
        userId: runner.id,
        raceCategoryId: category.id
      }
    },
    update: {},
    create: {
      userId: runner.id,
      raceEventId: alger10k.id,
      raceCategoryId: category.id,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "BARIDIMOB",
      emergencyContactName: "Nadia Belaid",
      emergencyContactPhone: "+213555000222",
      clubName: "Open Runner"
    }
  });

  console.info(`Seeded RaceDZ with admin ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
