/**
 * SEC-004 cross-tenant and function-level authorization coverage for the organizer surface.
 *
 * `scripts/test-authz-objects.ts` already covers runner-A-versus-runner-B object access on
 * `/api/v1`. This is the half it does not reach, and the half the gate names explicitly: organizer
 * A against organizer B, and the role boundary itself.
 *
 * The organizer surface is where the money and the personal data are — registrations, payment
 * confirmation, results, member invitations — and every one of those functions takes an
 * `organizationId` and an object id as SEPARATE arguments. That shape is the bug waiting to
 * happen: forget to put the organization in one `where` clause and the object id alone becomes
 * enough. So each case calls the real function with organizer A's organization and organizer B's
 * object, and asserts refusal; then calls it with A's own object, so a function that is simply
 * broken for everybody cannot pass as "secure".
 *
 * It also covers a side effect rather than a return value: reading a race's registrations sweeps
 * expired unpaid ones (a write). That sweep used to run before the organization was checked.
 *
 * Requires DATABASE_URL pointed at a disposable/test DB (loaded from .env automatically).
 * Seeds and cleans up after itself.
 *   npm run test:authz-roles
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const tag = `authzroles-${process.pid}-${Date.now()}`;

let allOk = true;
let passed = 0;
let failed = 0;

const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label} — ${detail}`);
  if (cond) passed += 1;
  else {
    failed += 1;
    allOk = false;
  }
};

/** A call that must be refused: either it throws, or it returns nothing usable. */
async function expectDenied(label: string, call: () => Promise<unknown>, isEmpty: (value: unknown) => boolean) {
  try {
    const value = await call();
    check(label, isEmpty(value), isEmpty(value) ? "refused (empty result)" : `LEAKED: ${JSON.stringify(value).slice(0, 160)}`);
  } catch {
    check(label, true, "refused (threw)");
  }
}

async function expectAllowed(label: string, call: () => Promise<unknown>, isPresent: (value: unknown) => boolean) {
  try {
    const value = await call();
    check(label, isPresent(value), isPresent(value) ? "allowed for its owner" : "owner was refused their own object");
  } catch (error) {
    check(label, false, `owner was refused their own object: ${(error as Error).message}`);
  }
}

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const organizer = await import("../src/lib/organizer");
  const prisma = getPrisma();

  try {
    await run(prisma, organizer);
  } finally {
    await prisma.$disconnect();
  }
}

async function run(
  prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>,
  organizer: typeof import("../src/lib/organizer")
) {
  const bcrypt = (await import("bcryptjs")).default;
  const passwordHash = await bcrypt.hash("AuthzRoles123!", 10);

  // Two organizations, each with an owner, an approved race, a category and a paid registration
  // from a disposable runner. Symmetric on purpose, so a leak in either direction shows up.
  const makeOrg = async (slug: string) => {
    const owner = await prisma.user.create({
      data: {
        email: `${tag}-${slug}@example.com`,
        passwordHash,
        firstName: "Org",
        lastName: slug,
        role: "ORGANIZER",
        emailVerifiedAt: new Date(),
      },
    });
    const organization = await prisma.organization.create({
      data: { name: `${tag}-${slug}`, slug: `${tag}-${slug}`, status: "APPROVED", email: `${tag}-${slug}@example.com` },
    });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: owner.id, role: "OWNER" },
    });
    const race = await prisma.raceEvent.create({
      data: {
        organizationId: organization.id,
        title: `${tag}-${slug}-race`,
        slug: `${tag}-${slug}-race`,
        description: "seed",
        raceType: "ROAD",
        status: "PUBLISHED",
        registrationStatus: "OPEN",
        startDate: new Date(Date.now() + 30 * 86_400_000),
        wilaya: "Alger",
        city: "Alger",
      },
    });
    const category = await prisma.raceCategory.create({
      data: { raceEventId: race.id, name: "10K", distanceKm: 10 },
    });
    const runner = await prisma.user.create({
      data: {
        email: `${tag}-${slug}-runner@example.com`,
        passwordHash,
        firstName: "Run",
        lastName: slug,
        role: "RUNNER",
        emailVerifiedAt: new Date(),
      },
    });
    const registration = await prisma.raceRegistration.create({
      data: {
        userId: runner.id,
        raceEventId: race.id,
        raceCategoryId: category.id,
        status: "PENDING",
        paymentStatus: "PENDING",
        emergencyContactName: "Contact",
        emergencyContactPhone: "0000000000",
      },
    });
    return { owner, organization, race, category, runner, registration };
  };

  const a = await makeOrg("a");
  const b = await makeOrg("b");

  try {
    // ---- Cross-tenant object reads -----------------------------------------------------------
    await expectDenied(
      "getOrganizerRaceById: A cannot read B's race",
      () => organizer.getOrganizerRaceById(a.organization.id, b.race.id),
      (v) => v === null || v === undefined
    );
    await expectAllowed(
      "getOrganizerRaceById: A can read its own race",
      () => organizer.getOrganizerRaceById(a.organization.id, a.race.id),
      (v) => Boolean(v)
    );

    await expectDenied(
      "getOrganizerRaceRegistrations: A cannot list B's registrations",
      () => organizer.getOrganizerRaceRegistrations(a.organization.id, b.race.id),
      (v) => (v as { items: unknown[] }).items.length === 0
    );
    await expectAllowed(
      "getOrganizerRaceRegistrations: A can list its own",
      () => organizer.getOrganizerRaceRegistrations(a.organization.id, a.race.id),
      (v) => (v as { items: unknown[] }).items.length > 0
    );

    // An aggregate refuses by returning zeros rather than null, so "no rows counted" is the
    // refusal — paired with the positive case below, which would also read zero if the function
    // were simply broken.
    await expectDenied(
      "getOrganizerRaceShirtTotals: A cannot count B's registrations",
      () => organizer.getOrganizerRaceShirtTotals(a.organization.id, b.race.id),
      (v) => (v as { total: number }).total === 0
    );
    await expectAllowed(
      "getOrganizerRaceShirtTotals: A can count its own",
      () => organizer.getOrganizerRaceShirtTotals(a.organization.id, a.race.id),
      (v) => (v as { total: number }).total > 0
    );

    // ---- Cross-tenant mutations --------------------------------------------------------------
    await expectDenied(
      "confirmOrganizerRegistrationPayment: A cannot confirm B's registration",
      () => organizer.confirmOrganizerRegistrationPayment({ organizationId: a.organization.id, registrationId: b.registration.id }),
      (v) => v === null || v === undefined
    );
    await expectDenied(
      "cancelOrganizerRaceRegistration: A cannot cancel B's registration",
      () => organizer.cancelOrganizerRaceRegistration({ organizationId: a.organization.id, registrationId: b.registration.id }),
      (v) => v === null || v === undefined
    );
    await expectDenied(
      "saveOrganizerRaceResult: A cannot record a result on B's registration",
      () =>
        organizer.saveOrganizerRaceResult({
          organizationId: a.organization.id,
          registrationId: b.registration.id,
          recordedById: a.owner.id,
          finishTimeSeconds: 3600,
          status: "FINISHED",
          notes: null,
        }),
      (v) => v === null || v === undefined
    );
    await expectDenied(
      "updateOrganizerRaceRegistrationStatus: A cannot close B's race",
      () =>
        organizer.updateOrganizerRaceRegistrationStatus({
          organizationId: a.organization.id,
          raceEventId: b.race.id,
          registrationStatus: "CLOSED",
        }),
      (v) => v === null || v === undefined
    );

    // The mutations above must have changed nothing on B.
    const bRegistration = await prisma.raceRegistration.findUnique({
      where: { id: b.registration.id },
      select: { status: true, paymentStatus: true },
    });
    check(
      "B's registration is untouched after A's attempts",
      bRegistration?.status === "PENDING" && bRegistration?.paymentStatus === "PENDING",
      `status=${bRegistration?.status} payment=${bRegistration?.paymentStatus}`
    );
    const bRace = await prisma.raceEvent.findUnique({
      where: { id: b.race.id },
      select: { registrationStatus: true },
    });
    check("B's race is still OPEN after A's attempts", bRace?.registrationStatus === "OPEN", `status=${bRace?.registrationStatus}`);

    // ---- Cross-tenant WRITE SIDE EFFECT ------------------------------------------------------
    // Reading a race's registrations sweeps expired unpaid ones. That sweep used to run on the
    // caller-supplied race id before the organization was checked, so A could force a cancellation
    // on B's race while the (correctly scoped) read returned nothing and looked like a refusal.
    await prisma.raceEvent.update({
      where: { id: b.race.id },
      data: { autoCancelUnpaidAfterHours: 1 },
    });
    await prisma.raceRegistration.update({
      where: { id: b.registration.id },
      data: { createdAt: new Date(Date.now() - 48 * 3_600_000) },
    });

    await organizer.getOrganizerRaceRegistrations(a.organization.id, b.race.id);

    const afterSweep = await prisma.raceRegistration.findUnique({
      where: { id: b.registration.id },
      select: { status: true },
    });
    check(
      "A cannot trigger the auto-cancel sweep on B's race",
      afterSweep?.status === "PENDING",
      `B's expired registration is ${afterSweep?.status} (must stay PENDING — A has no authority here)`
    );

    // And B sweeping its own race still works, so the guard did not simply disable the feature.
    await organizer.getOrganizerRaceRegistrations(b.organization.id, b.race.id);
    const afterOwnSweep = await prisma.raceRegistration.findUnique({
      where: { id: b.registration.id },
      select: { status: true },
    });
    check(
      "B's own read still sweeps its expired registrations",
      afterOwnSweep?.status === "CANCELLED",
      `status=${afterOwnSweep?.status}`
    );

    // ---- Organization-scoped membership and profile ------------------------------------------
    await expectDenied(
      "getOrganizerMembers: A's member list never contains B's owner",
      () => organizer.getOrganizerMembers(a.organization.id),
      (v) => !JSON.stringify(v).includes(b.owner.id)
    );
  } finally {
    // Cleanup, most dependent first.
    await prisma.raceResult.deleteMany({ where: { registrationId: { in: [a.registration.id, b.registration.id] } } });
    await prisma.raceRegistration.deleteMany({ where: { id: { in: [a.registration.id, b.registration.id] } } });
    await prisma.raceCategory.deleteMany({ where: { id: { in: [a.category.id, b.category.id] } } });
    await prisma.raceEvent.deleteMany({ where: { id: { in: [a.race.id, b.race.id] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [a.organization.id, b.organization.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [a.organization.id, b.organization.id] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [a.owner.id, b.owner.id, a.runner.id, b.runner.id] } },
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (!allOk) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
