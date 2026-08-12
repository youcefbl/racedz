/**
 * SEC-004: export and private-media denial tests.
 *
 * The gate names these separately from the object/role suites, and rightly: an export is the one
 * operation that turns a scoped read into a file the caller keeps. A missing `userId` in a normal
 * read leaks one row on one screen; the same mistake in an export hands over the whole set in a
 * form that outlives the session.
 *
 * Two surfaces are covered.
 *
 *   Private media — race-registration payment proofs. A proof is a photo of a bank transfer or CCP
 *   receipt: financial PII, and the only file here whose access rule has THREE allowed parties
 *   (the runner, an admin, a member of the race's own organization) and therefore three ways to be
 *   wrong. The organization half is the interesting one, because it needs a second query against a
 *   join table and "is a member of some organization" is one dropped `where` clause away from
 *   "is a member of this one".
 *
 *   Exports — a runner's GPX route export and their coach-memory export. Both are the runner's own
 *   most sensitive data (precise GPS; extracted facts including injuries), and both take an id or a
 *   user id from the caller.
 *
 * Every denial is paired with the allowed party's own call succeeding, so a function that is simply
 * broken for everybody cannot pass as secure.
 *
 * Requires DATABASE_URL pointed at a disposable/test DB (loaded from .env automatically).
 * Seeds and cleans up after itself.
 *   npm run test:authz-exports
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const tag = `authzexp-${process.pid}-${Date.now()}`;

let passed = 0;
let failed = 0;

const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label} — ${detail}`);
  if (cond) passed += 1;
  else failed += 1;
};

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const { decideRegistrationProofAccess } = await import("../src/lib/registrations");
  const { getRunnerRunForExport } = await import("../src/lib/coach/service");
  const { exportMemory } = await import("../src/lib/coach/memory-store");
  const prisma = getPrisma();

  const created: { users: string[]; orgs: string[]; races: string[] } = { users: [], orgs: [], races: [] };

  try {
    // ---- Seed: a runner with a proof, an admin, a stranger, and two organizations ---------------
    const mkUser = async (name: string, role: "RUNNER" | "ADMIN" = "RUNNER") => {
      const user = await prisma.user.create({
        data: {
          email: `${tag}-${name}@example.test`,
          firstName: name,
          lastName: tag,
          role,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
      created.users.push(user.id);
      return user.id;
    };

    const runnerId = await mkUser("runner");
    const strangerId = await mkUser("stranger");
    const adminId = await mkUser("admin", "ADMIN");
    const hostMemberId = await mkUser("hostmember");
    const otherOrgMemberId = await mkUser("otherorgmember");

    const mkOrg = async (name: string) => {
      const org = await prisma.organization.create({
        data: {
          name: `${tag}-${name}`,
          slug: `${tag}-${name}`.toLowerCase(),
          status: "APPROVED",
          email: `${tag}-${name}@example.test`,
        },
        select: { id: true },
      });
      created.orgs.push(org.id);
      return org.id;
    };

    const hostOrgId = await mkOrg("hostorg");
    const otherOrgId = await mkOrg("otherorg");
    await prisma.organizationMember.create({ data: { organizationId: hostOrgId, userId: hostMemberId, role: "OWNER" } });
    await prisma.organizationMember.create({
      data: { organizationId: otherOrgId, userId: otherOrgMemberId, role: "OWNER" },
    });

    const race = await prisma.raceEvent.create({
      data: {
        organizationId: hostOrgId,
        title: `${tag}-race`,
        slug: `${tag}-race`,
        description: "seeded",
        raceType: "ROAD",
        status: "PUBLISHED",
        registrationStatus: "OPEN",
        startDate: new Date(Date.now() + 30 * 86_400_000),
        wilaya: "Alger",
        city: "Alger",
      },
      select: { id: true },
    });
    created.races.push(race.id);

    const category = await prisma.raceCategory.create({
      data: { raceEventId: race.id, name: `${tag}-10k`, distanceKm: 10, priceDzd: 2000 },
      select: { id: true },
    });

    const registration = await prisma.raceRegistration.create({
      data: {
        raceEventId: race.id,
        raceCategoryId: category.id,
        userId: runnerId,
        emergencyContactName: "Kin",
        emergencyContactPhone: "+213555000222",
        paymentMethod: "BANK_TRANSFER",
        paymentProofUrl: "/uploads/payment/seeded-proof.jpg",
      },
      select: { id: true },
    });

    // ---- Private media: who can read the payment proof -----------------------------------------
    const decide = (viewerId: string, viewerRole?: string) =>
      decideRegistrationProofAccess({ registrationId: registration.id, viewerId, viewerRole });

    const owner = await decide(runnerId);
    check("the runner can read their own payment proof", owner.allowed && owner.via === "owner", JSON.stringify(owner));

    const admin = await decide(adminId, "ADMIN");
    check("an admin can read a payment proof", admin.allowed && admin.via === "admin", JSON.stringify(admin));

    const host = await decide(hostMemberId);
    check(
      "a member of the race's own organization can read it",
      host.allowed && host.via === "organizer",
      JSON.stringify(host)
    );

    // The three that must be refused. A leaked proofUrl is the actual damage, so assert on that too.
    const stranger = await decide(strangerId);
    check(
      "an unrelated runner is refused",
      !stranger.allowed && stranger.reason === "forbidden",
      JSON.stringify(stranger)
    );

    const otherOrg = await decide(otherOrgMemberId);
    check(
      "an organizer of a DIFFERENT organization is refused",
      !otherOrg.allowed && otherOrg.reason === "forbidden",
      JSON.stringify(otherOrg)
    );

    // Role is read from the session, so a client-supplied role string must not be enough on its own —
    // but the more realistic mistake is a role we do not recognise being treated as privileged.
    const fakeRole = await decide(strangerId, "ORGANIZER");
    check(
      "a non-admin role does not grant access",
      !fakeRole.allowed,
      JSON.stringify(fakeRole)
    );

    // A registration with no proof answers not_found rather than forbidden, so the route can tell an
    // authorization event apart from a stale link without disclosing either to the caller.
    const noProof = await prisma.raceRegistration.create({
      data: {
        raceEventId: race.id,
        raceCategoryId: category.id,
        userId: strangerId,
        emergencyContactName: "Kin",
        emergencyContactPhone: "+213555000444",
      },
      select: { id: true },
    });
    const missing = await decideRegistrationProofAccess({
      registrationId: noProof.id,
      viewerId: strangerId,
    });
    check(
      "a registration with no proof is not_found, not forbidden",
      !missing.allowed && missing.reason === "not_found",
      JSON.stringify(missing)
    );

    const unknownId = await decideRegistrationProofAccess({ registrationId: "reg_does_not_exist", viewerId: adminId });
    check(
      "even an admin gets not_found for an id that does not exist",
      !unknownId.allowed && unknownId.reason === "not_found",
      JSON.stringify(unknownId)
    );

    // ---- Exports: a run's GPX route -------------------------------------------------------------
    const run = await prisma.runnerRun.create({
      data: {
        userId: runnerId,
        title: `${tag} run`,
        startedAt: new Date(),
        distanceKm: 5,
        durationSeconds: 1800,
        averagePaceSecondsPerKm: 360,
        perceivedEffort: 5,
        route: [
          { lat: 36.7538, lng: 3.0588 },
          { lat: 36.7541, lng: 3.0592 },
        ],
      },
      select: { id: true },
    });

    const ownExport = await getRunnerRunForExport(runnerId, run.id);
    check("the runner can export their own run", Boolean(ownExport?.route), ownExport ? "route returned" : "null");

    const stolenExport = await getRunnerRunForExport(strangerId, run.id);
    check(
      "another runner cannot export that run's GPS route",
      stolenExport === null,
      stolenExport ? `LEAKED: ${JSON.stringify(stolenExport).slice(0, 120)}` : "refused (null)"
    );

    const adminExport = await getRunnerRunForExport(adminId, run.id);
    check(
      "an admin cannot export a runner's route through this path either",
      adminExport === null,
      adminExport ? `LEAKED: ${JSON.stringify(adminExport).slice(0, 120)}` : "refused (null)"
    );

    // ---- Exports: coach memory (raw SQL, so scoping cannot be assumed from Prisma) ---------------
    // Deliberately goal-less: `goalId` is nullable for facts that hold across goals, and a fact
    // with no goal has one less column that could accidentally be doing the scoping.
    await prisma.coachMemory.create({
      data: {
        userId: runnerId,
        kind: "CONSTRAINT",
        key: "knee",
        value: "left knee pain on descents",
        source: "RUNNER_STATED",
        status: "ACTIVE",
      },
    });

    const ownMemory = await exportMemory(runnerId);
    check(
      "the runner's memory export returns their own facts",
      ownMemory.some((row) => row.key === "knee"),
      `${ownMemory.length} row(s)`
    );

    const strangerMemory = await exportMemory(strangerId);
    check(
      "another runner's memory export cannot see those facts",
      !strangerMemory.some((row) => row.key === "knee"),
      strangerMemory.length === 0 ? "refused (empty)" : `LEAKED ${strangerMemory.length} row(s)`
    );
  } finally {
    // Cleanest order: children first, then the rows they point at.
    await prisma.coachMemory.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.runnerRun.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.raceRegistration.deleteMany({ where: { raceEventId: { in: created.races } } });
    await prisma.raceCategory.deleteMany({ where: { raceEventId: { in: created.races } } });
    await prisma.raceEvent.deleteMany({ where: { id: { in: created.races } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: created.orgs } } });
    await prisma.organization.deleteMany({ where: { id: { in: created.orgs } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
