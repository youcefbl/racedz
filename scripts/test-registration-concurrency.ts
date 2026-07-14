/**
 * Concurrency test for the atomic registration fix (execution-plan scale step 1).
 *
 * Fires WAVE registrations at a single capped race *concurrently* (the registration-open
 * thundering-herd) and asserts the cap is never overshot. Runs two isolated scenarios so
 * each guard is exercised on its own:
 *   - "category cap"     — availablePlaces null, maxParticipants=CAP → the SELECT ... FOR UPDATE
 *                          row lock is the only thing enforcing the limit.
 *   - "availablePlaces"  — maxParticipants null, availablePlaces=CAP → the atomic guarded
 *                          decrement is the only thing enforcing the limit.
 *
 * Requires DATABASE_URL pointed at a disposable/test DB. Seeds and cleans up after itself.
 * Run: NODE_OPTIONS="--require ./scripts/_stubs/stub-server-only.cjs" npx tsx scripts/test-registration-concurrency.ts
 */
import { getPrisma } from "../src/lib/db";
import { createRaceRegistrationForUser, RegistrationError } from "../src/lib/registrations";

const prisma = getPrisma();

const CAP = 5;
const WAVE = 40;

let allOk = true;
const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!cond) allOk = false;
};

async function scenario(
  name: string,
  caps: { availablePlaces: number | null; maxParticipants: number | null }
) {
  const tag = `conc-${name}-${process.pid}`;

  const race = await prisma.raceEvent.create({
    data: {
      title: `${tag} race`,
      slug: `${tag}-race`,
      description: "concurrency test",
      raceType: "TEN_K",
      status: "PUBLISHED",
      registrationStatus: "OPEN",
      startDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      wilaya: "Alger",
      city: "Alger",
      availablePlaces: caps.availablePlaces,
      categories: {
        create: { name: "10K", distanceKm: 10, maxParticipants: caps.maxParticipants }
      }
    },
    include: { categories: true }
  });
  const category = race.categories[0];

  const users = await Promise.all(
    Array.from({ length: WAVE }, (_, i) =>
      prisma.user.create({
        data: { email: `${tag}-u${i}@example.test`, firstName: "Run", lastName: `User${i}` }
      })
    )
  );

  const input = (i: number) => ({
    firstName: "Run",
    lastName: `User${i}`,
    email: `${tag}-u${i}@example.test`,
    phone: "0600000000",
    dateOfBirth: "1990-01-01",
    gender: "MALE" as const,
    wilaya: "Alger",
    city: "Alger",
    emergencyContactName: "Kin Person",
    emergencyContactPhone: "0600000001",
    raceCategoryId: category.id,
    acceptedTerms: true
  });

  const outcomes = await Promise.allSettled(
    users.map((u, i) =>
      createRaceRegistrationForUser({ userId: u.id, raceEventId: race.id, input: input(i) })
    )
  );

  const succeeded = outcomes.filter((o) => o.status === "fulfilled").length;
  const full = outcomes.filter(
    (o) => o.status === "rejected" && o.reason instanceof RegistrationError
  ).length;
  const unexpected = outcomes.filter(
    (o) => o.status === "rejected" && !(o.reason instanceof RegistrationError)
  );

  const liveCount = await prisma.raceRegistration.count({
    where: { raceCategoryId: category.id, status: { notIn: ["CANCELLED", "REJECTED"] } }
  });
  const remaining = (await prisma.raceEvent.findUnique({ where: { id: race.id } }))?.availablePlaces;

  console.log(`\n[${name}]  caps=${JSON.stringify(caps)}`);
  check(`${name}: exactly CAP succeed`, succeeded === CAP, `${succeeded} fulfilled (want ${CAP})`);
  check(`${name}: rest rejected as full`, full === WAVE - CAP, `${full} full (want ${WAVE - CAP})`);
  check(`${name}: no unexpected errors`, unexpected.length === 0, `${unexpected.length} unexpected`);
  check(`${name}: DB never overshoots cap`, liveCount === CAP, `${liveCount} live (want ${CAP})`);
  if (caps.availablePlaces != null) {
    check(`${name}: availablePlaces bottoms at 0`, remaining === 0, `availablePlaces=${remaining} (want 0)`);
  }
  if (unexpected.length) console.log("  first unexpected:", (unexpected[0] as PromiseRejectedResult).reason);

  // cleanup (children first — no cascade on these FKs)
  const userIds = users.map((u) => u.id);
  const notifications = await prisma.notification.findMany({
    where: { userId: { in: userIds } },
    select: { id: true }
  });
  await prisma.notificationDelivery.deleteMany({
    where: { notificationId: { in: notifications.map((n) => n.id) } }
  });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.raceRegistration.deleteMany({ where: { raceEventId: race.id } });
  await prisma.raceCategory.deleteMany({ where: { raceEventId: race.id } });
  await prisma.raceEvent.delete({ where: { id: race.id } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  await scenario("category-cap", { availablePlaces: null, maxParticipants: CAP });
  await scenario("available-places", { availablePlaces: CAP, maxParticipants: null });

  console.log(allOk ? "\n✅ all checks passed" : "\n❌ some checks failed");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
