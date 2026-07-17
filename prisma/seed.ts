import { PrismaClient, type Prisma, type RaceType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const WILAYAS = [
  "Alger",
  "Oran",
  "Constantine",
  "Annaba",
  "Blida",
  "Tizi Ouzou",
  "Setif",
  "Batna",
  "Djelfa",
  "Bejaia",
  "Biskra",
  "Tiaret",
  "Tlemcen",
  "Ouargla",
  "Bechar",
  "Skikda",
  "Mostaganem",
  "M'Sila",
  "Chlef",
  "El Oued"
];

const RACE_TYPES: RaceType[] = [
  "ROAD",
  "TRAIL",
  "ULTRA_TRAIL",
  "MARATHON",
  "HALF_MARATHON",
  "TEN_K",
  "FIVE_K",
  "KIDS",
  "CHARITY",
  "OTHER"
];

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickSome<T>(items: T[], max: number): T[] {
  const count = Math.floor(Math.random() * max) + 1;
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const passwordHash = await bcrypt.hash("racedz-demo-password", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@zidrun.com" },
    update: {},
    create: {
      email: "admin@zidrun.com",
      passwordHash,
      firstName: "ZidRun",
      lastName: "Admin",
      arabicFullName: "إدارة رايس ديزاد",
      role: "SUPERADMIN"
    }
  });

  const organizerUser = await prisma.user.upsert({
    where: { email: "organizer@zidrun.com" },
    update: {},
    create: {
      email: "organizer@zidrun.com",
      passwordHash,
      firstName: "Amina",
      lastName: "Mansouri",
      arabicFullName: "أمينة منصوري",
      role: "ORGANIZER",
      nationalId: "ORG-DEMO-001",
      avatarUrl: "/brand/zidrun-logo.png",
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
      avatarUrl: "/brand/zidrun-logo.png",
      wilaya: "Oran",
      city: "Oran",
      commune: "Oran"
    }
  });

  await prisma.$executeRaw`
    UPDATE "User"
    SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW())
    WHERE "id" IN (${admin.id}, ${organizerUser.id}, ${runner.id})
  `;

  const algerClub = await prisma.organization.upsert({
    where: { slug: "alger-running-club" },
    update: {},
    create: {
      name: "Alger Running Club",
      slug: "alger-running-club",
      description: "Community road running organizer in Alger.",
      email: "club@zidrun.com",
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
      email: "oran@zidrun.com",
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
      email: "trail@zidrun.com",
      wilaya: "Tizi Ouzou",
      city: "Tizi Ouzou",
      commune: "Tizi Ouzou",
      status: "APPROVED"
    }
  });

  const organizations = [algerClub, oranTeam, kabylieRunners];

  await prisma.raceEvent.upsert({
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
      mainImageUrl: "/brand/zidrun-logo.png",
      organizerName: "Alger Running Club",
      organizerUrl: "https://zidrun.com/organizations/alger-running-club",
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
      mainImageUrl: "/brand/zidrun-logo.png",
      organizerName: "Oran Trail Team",
      organizerUrl: "https://zidrun.com/organizations/oran-trail-team",
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
      mainImageUrl: "/brand/zidrun-logo.png",
      organizerName: "Kabylie Mountain Runners",
      organizerUrl: "https://zidrun.com/organizations/kabylie-mountain-runners",
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
      mainImageUrl: "/brand/zidrun-logo.png",
      organizerName: "ZidRun Community Desk",
      organizerUrl: "https://zidrun.com",
      contactEmail: "events@zidrun.com",
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

  const demoCategory = await prisma.raceCategory.findFirstOrThrow({
    where: {
      raceEvent: { slug: "alger-10k" },
      name: "10K Open"
    }
  });

  await prisma.raceRegistration.upsert({
    where: {
      userId_raceCategoryId: {
        userId: runner.id,
        raceCategoryId: demoCategory.id
      }
    },
    update: {},
    create: {
      userId: runner.id,
      raceEventId: demoCategory.raceEventId,
      raceCategoryId: demoCategory.id,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "BARIDIMOB",
      emergencyContactName: "Nadia Belaid",
      emergencyContactPhone: "+213555000222",
      clubName: "Open Runner"
    }
  });

  await seedBulkUsers(passwordHash);
  await seedBulkRaces(organizations);
  await seedCoachTips();

  console.info(`Seeded ZidRun with admin ${admin.email}`);
}

// The original hardcoded coach tips, now stored in the DB as published GENERAL tips.
// Each entry is [en, fr, ar] to match the app's sibling-column localization convention.
const GENERAL_COACH_TIPS: Array<[string, string, string]> = [
  [
    "Warm up with 5 minutes of easy jogging and leg swings before every run to prevent injury.",
    "Échauffez-vous avec 5 minutes de footing léger et des balancements de jambes avant chaque sortie pour éviter les blessures.",
    "ابدأ بإحماء 5 دقائق من الجري الخفيف وتمارين تأرجح الساق قبل كل حصة لتفادي الإصابات."
  ],
  [
    "Follow the 10% rule: don't increase your weekly distance by more than 10% to avoid overuse injuries.",
    "Suivez la règle des 10 % : n'augmentez pas votre distance hebdomadaire de plus de 10 % pour éviter les blessures de surmenage.",
    "اتبع قاعدة الـ10٪: لا تزد مسافتك الأسبوعية بأكثر من 10٪ لتجنب إصابات الإجهاد."
  ],
  [
    "Cool down and stretch your calves, hamstrings, and quads after each run to aid recovery.",
    "Récupérez en étirant mollets, ischio-jambiers et quadriceps après chaque sortie.",
    "قم بالتهدئة وإطالة عضلات الساق والفخذ بعد كل حصة لتسريع الاستشفاء."
  ],
  [
    "Replace running shoes every 600–800 km — worn soles are a common cause of knee and shin pain.",
    "Changez vos chaussures tous les 600–800 km — des semelles usées causent souvent des douleurs au genou et au tibia.",
    "غيّر حذاء الجري كل 600–800 كم — النعل المهترئ سبب شائع لآلام الركبة والساق."
  ],
  [
    "Hydrate before, during, and after long runs, and run in breathable, moisture-wicking clothing.",
    "Hydratez-vous avant, pendant et après les sorties longues, et portez des vêtements respirants.",
    "اشرب الماء قبل الجري الطويل وأثناءه وبعده، والبس ملابس مريحة تسمح بالتهوية."
  ],
  [
    "Easy runs should feel conversational — if you can't talk in full sentences, slow down.",
    "Les sorties faciles doivent rester conversationnelles — si vous ne pouvez pas parler, ralentissez.",
    "يجب أن تكون الحصص السهلة بوتيرة تسمح بالحديث — إن لم تستطع الكلام فأبطئ."
  ],
  [
    "Prioritise sleep: most of your fitness gains happen during recovery, not the run itself.",
    "Privilégiez le sommeil : la plupart des progrès se font pendant la récupération, pas pendant la course.",
    "أعطِ النوم أولوية: معظم تحسّن لياقتك يحدث أثناء الاستشفاء وليس أثناء الجري."
  ]
];

async function seedCoachTips() {
  const existing = await prisma.coachTip.count();
  if (existing > 0) {
    console.info(`Skipping coach tips: ${existing} already seeded.`);
    return;
  }

  await prisma.coachTip.createMany({
    data: GENERAL_COACH_TIPS.map(([textEn, textFr, textAr]) => ({
      category: "GENERAL" as const,
      status: "PUBLISHED" as const,
      source: "MANUAL" as const,
      textEn,
      textFr,
      textAr
    }))
  });
  console.info(`Seeded ${GENERAL_COACH_TIPS.length} coach tips`);
}

async function seedBulkUsers(passwordHash: string) {
  const BATCH_SIZE = 1000;
  const TOTAL_USERS = 10_000;

  const existing = await prisma.user.count({
    where: { email: { startsWith: "seeded-user-" } }
  });

  if (existing >= TOTAL_USERS) {
    console.info(`Skipping bulk users: ${existing} already seeded.`);
    return;
  }

  const remaining = TOTAL_USERS - existing;
  const firstNames = ["Karim", "Amina", "Youssef", "Fatima", "Omar", "Sara", "Hassan", "Nadia", "Mehdi", "Lina"];
  const lastNames = ["Belaid", "Mansouri", "Boudiaf", "Cherif", "Hamdi", "Kaci", "Medelci", "Sahnoun", "Taleb", "Zeroual"];

  for (let batch = 0; batch < Math.ceil(remaining / BATCH_SIZE); batch++) {
    const users: Prisma.UserCreateManyInput[] = [];
    const offset = existing + batch * BATCH_SIZE;
    const limit = Math.min(BATCH_SIZE, remaining - batch * BATCH_SIZE);

    for (let i = 0; i < limit; i++) {
      const index = offset + i;
      const firstName = pickOne(firstNames);
      const lastName = pickOne(lastNames);
      const wilaya = pickOne(WILAYAS);
      users.push({
        email: `seeded-user-${index}@example.com`,
        passwordHash,
        firstName,
        lastName,
        role: "RUNNER",
        nationalId: `SEED-${String(index).padStart(6, "0")}`,
        wilaya,
        city: wilaya,
        commune: wilaya
      });
    }

    await prisma.user.createMany({ data: users, skipDuplicates: true });
    await prisma.$executeRaw`
      UPDATE "User"
      SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW())
      WHERE "email" LIKE 'seeded-user-%@example.com'
    `;
    console.info(`Seeded ${Math.min(offset + limit, TOTAL_USERS)} / ${TOTAL_USERS} users`);
  }
}

async function seedBulkRaces(organizations: Array<{ id: string }>) {
  const TOTAL_RACES = 100;
  const OPEN_RACES = 50;

  const existing = await prisma.raceEvent.count({
    where: { slug: { startsWith: "seeded-race-" } }
  });

  const racesToCreate = TOTAL_RACES - 4 - existing;

  if (racesToCreate > 0) {
    const raceData: Prisma.RaceEventCreateManyInput[] = [];

    for (let i = 0; i < racesToCreate; i++) {
      const index = existing + i;
      const wilaya = pickOne(WILAYAS);
      const isOpen = index < OPEN_RACES - 4;
      const organization = Math.random() > 0.3 ? pickOne(organizations) : null;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + randomInt(14, 365));

      raceData.push({
        organizationId: organization?.id ?? null,
        source: organization ? "ORGANIZATION" : "PLATFORM",
        title: `Seeded Race ${index + 1}`,
        slug: `seeded-race-${index + 1}`,
        description: `Auto-generated race ${index + 1} in ${wilaya}.`,
        raceType: pickOne(RACE_TYPES),
        status: isOpen ? "PUBLISHED" : pickOne(["PENDING_REVIEW", "PUBLISHED", "CANCELLED", "REJECTED"]),
        registrationStatus: isOpen ? "OPEN" : pickOne(["NOT_OPEN", "CLOSED", "FULL", "CANCELLED"]),
        startDate,
        registrationOpenAt: new Date(),
        registrationCloseAt: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        wilaya,
        city: wilaya,
        commune: wilaya,
        address: `${wilaya} city center`,
        mainImageUrl: "/brand/zidrun-logo.png",
        organizerName: organization ? "Seeded Organizer" : "ZidRun Community Desk",
        maxParticipants: randomInt(200, 3000),
        availablePlaces: randomInt(50, 3000)
      });
    }

    await prisma.raceEvent.createMany({ data: raceData, skipDuplicates: true });
    console.info(`Seeded ${raceData.length} bulk races`);
  } else {
    console.info(`Skipping bulk race creation: ${existing} already seeded.`);
  }

  const allOpenRaces = await prisma.raceEvent.findMany({
    where: { registrationStatus: "OPEN", status: "PUBLISHED" },
    select: { id: true, maxParticipants: true, availablePlaces: true }
  });

  for (const race of allOpenRaces.slice(0, OPEN_RACES)) {
    await seedCategoriesForRace(race.id);
  }

  await seedRandomRegistrations();
}

async function seedCategoriesForRace(raceEventId: string) {
  const existing = await prisma.raceCategory.count({ where: { raceEventId } });
  if (existing > 0) {
    return;
  }

  const categoryCount = randomInt(1, 3);
  const categories: Prisma.RaceCategoryCreateManyInput[] = [];
  const distances = [5, 10, 21.1, 25, 42.195, 50];

  for (let i = 0; i < categoryCount; i++) {
    const distance = pickOne(distances);
    categories.push({
      raceEventId,
      name: `${distance}K Category`,
      raceType: pickOne(RACE_TYPES),
      distanceKm: distance,
      priceDzd: randomInt(500, 5000),
      maxParticipants: randomInt(100, 1500)
    });
  }

  await prisma.raceCategory.createMany({ data: categories });
}

async function seedRandomRegistrations() {
  const openCategories = await prisma.raceCategory.findMany({
    where: { raceEvent: { registrationStatus: "OPEN", status: "PUBLISHED" } },
    select: { id: true, raceEventId: true }
  });

  if (openCategories.length === 0) {
    return;
  }

  const seededUsers = await prisma.user.findMany({
    where: { email: { startsWith: "seeded-user-" } },
    select: { id: true }
  });

  const registrations: Prisma.RaceRegistrationCreateManyInput[] = [];
  const seen = new Set<string>();

  for (const category of openCategories) {
    const registrationCount = randomInt(0, 200);
    const selectedUsers = pickSome(seededUsers, Math.min(registrationCount, seededUsers.length));

    for (const user of selectedUsers) {
      const key = `${user.id}:${category.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      registrations.push({
        userId: user.id,
        raceEventId: category.raceEventId,
        raceCategoryId: category.id,
        status: pickOne(["PENDING", "CONFIRMED", "WAITING_LIST"]),
        paymentStatus: pickOne(["NOT_REQUIRED", "PENDING", "PAID", "MANUAL_REVIEW"]),
        paymentMethod: "BARIDIMOB",
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "+213555000000"
      });
    }
  }

  if (registrations.length > 0) {
    await prisma.raceRegistration.createMany({ data: registrations, skipDuplicates: true });
    console.info(`Seeded ${registrations.length} registrations`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
