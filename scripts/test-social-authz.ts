/**
 * SEC-004 negative-path authorization coverage for the social layer (kudos/follow).
 *
 * Exercises the exact bug fixed in this pass: toggleKudos() checked run.isPublic but not the
 * run owner's profilePrivate, so a runId obtained before the owner went private (stale feed
 * reference, shared link, etc.) could be kudoed forever. Also covers the existing toggleFollow
 * private-profile guard and RUN_NOT_FOUND on another user's private run.
 *
 * Requires DATABASE_URL pointed at a disposable/test DB. Seeds and cleans up after itself.
 * Run: npx tsx scripts/test-social-authz.ts
 */
import { getPrisma } from "../src/lib/db";
import { toggleFollow, toggleKudos } from "../src/lib/social";

const prisma = getPrisma();
const tag = `authz-${process.pid}-${Date.now()}`;

let allOk = true;
const check = (label: string, cond: boolean, detail: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!cond) allOk = false;
};

async function main() {
  const runnerA = await prisma.user.create({
    data: { email: `${tag}-a@example.test`, firstName: "Runner", lastName: "A" }
  });
  const runnerB = await prisma.user.create({
    data: { email: `${tag}-b@example.test`, firstName: "Runner", lastName: "B" }
  });

  const publicRun = await prisma.runnerRun.create({
    data: {
      userId: runnerA.id,
      startedAt: new Date(),
      distanceKm: 5,
      durationSeconds: 1500,
      averagePaceSecondsPerKm: 300,
      perceivedEffort: 5,
      isPublic: true
    }
  });
  const privateRun = await prisma.runnerRun.create({
    data: {
      userId: runnerA.id,
      startedAt: new Date(),
      distanceKm: 5,
      durationSeconds: 1500,
      averagePaceSecondsPerKm: 300,
      perceivedEffort: 5,
      isPublic: false
    }
  });

  // Runner B can kudos runner A's public run while A's profile is public.
  const kudoed = await toggleKudos(runnerB.id, publicRun.id);
  check("kudos allowed on public run / public profile", kudoed.kudoed === true, `kudoed=${kudoed.kudoed}`);
  await toggleKudos(runnerB.id, publicRun.id); // undo, back to clean state

  // Runner B cannot kudos runner A's non-public run.
  try {
    await toggleKudos(runnerB.id, privateRun.id);
    check("kudos rejected on non-public run", false, "did not throw");
  } catch (err) {
    check("kudos rejected on non-public run", (err as Error).message === "RUN_NOT_FOUND", (err as Error).message);
  }

  // Runner A goes private. The public run is still isPublic=true, but runner A's profile is now private.
  await prisma.user.update({ where: { id: runnerA.id }, data: { profilePrivate: true } });
  try {
    await toggleKudos(runnerB.id, publicRun.id);
    check("kudos rejected once run owner goes private", false, "did not throw — stale runId still kudoable");
  } catch (err) {
    check(
      "kudos rejected once run owner goes private",
      (err as Error).message === "RUN_NOT_FOUND",
      (err as Error).message
    );
  }

  // The run owner can always toggle kudos on their own run regardless of privacy.
  const ownKudos = await toggleKudos(runnerA.id, publicRun.id);
  check("owner can kudos own run while private", ownKudos.kudoed === true, `kudoed=${ownKudos.kudoed}`);

  // Follow: cannot follow a private profile.
  const followResult = await toggleFollow(runnerB.id, runnerA.id);
  check("follow rejected on private profile", followResult.following === false, `following=${followResult.following}`);

  // Follow: allowed once the target goes public again.
  await prisma.user.update({ where: { id: runnerA.id }, data: { profilePrivate: false } });
  const followResult2 = await toggleFollow(runnerB.id, runnerA.id);
  check("follow allowed on public profile", followResult2.following === true, `following=${followResult2.following}`);

  const testUserIds = [runnerA.id, runnerB.id];
  await prisma.runKudos.deleteMany({ where: { runId: { in: [publicRun.id, privateRun.id] } } });
  await prisma.follow.deleteMany({ where: { followerId: runnerB.id } });
  await prisma.notificationDelivery.deleteMany({ where: { notification: { userId: { in: testUserIds } } } });
  await prisma.notification.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.runnerRun.deleteMany({ where: { id: { in: [publicRun.id, privateRun.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });

  if (!allOk) {
    console.error("Social authorization checks FAILED.");
    process.exit(1);
  }
  console.log("Social kudos/follow privacy authorization checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
