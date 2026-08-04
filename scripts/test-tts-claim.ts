import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

// FD1-R02: the same-key TTS single-flight is only as good as its claim statement, and that
// statement is the one thing a provider-free test CAN pin exactly. These checks drive the real SQL
// against the real table: exactly one winner under contention, no takeover while a lease is live,
// takeover once it has expired, and a release that only ever clears its own claim.
//
// What this deliberately does NOT cover: the OpenAI call itself. No provider request is made here,
// so "one paid call per cache key" is verified at the ownership invariant, not end to end.

const prisma = new PrismaClient();

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

/** The exact statement src/lib/coach/tts.ts uses to take ownership. */
async function claim(cacheKey: string, ownerId: string, leaseMs: number): Promise<boolean> {
  const leaseUntil = new Date(Date.now() + leaseMs);
  const rows = await prisma.$executeRaw`
    INSERT INTO "TtsCacheClaim" ("cacheKey", "ownerId", "claimedAt", "leaseUntil")
    VALUES (${cacheKey}, ${ownerId}, NOW(), ${leaseUntil})
    ON CONFLICT ("cacheKey") DO UPDATE
      SET "ownerId" = ${ownerId}, "claimedAt" = NOW(), "leaseUntil" = ${leaseUntil}
      WHERE "TtsCacheClaim"."leaseUntil" < NOW()
  `;
  return rows === 1;
}

async function release(cacheKey: string, ownerId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "TtsCacheClaim" WHERE "cacheKey" = ${cacheKey} AND "ownerId" = ${ownerId}
  `;
}

async function main() {
  console.log("\nTTS cache-key single-flight (FD1-R02)\n");
  const key = `test-${randomUUID()}`;

  try {
    // 1) Contention: many workers race for one uncached phrase; exactly one may call the provider.
    const contenders = Array.from({ length: 8 }, () => randomUUID());
    const results = await Promise.all(contenders.map((owner) => claim(key, owner, 60_000)));
    const winners = results.filter(Boolean).length;
    check("exactly one worker wins a contested cache key", winners === 1, { winners });

    const holder = contenders[results.indexOf(true)];

    // 2) A live lease is not stealable — this is what stops a duplicate paid call while a slow
    //    provider retry is still in flight.
    check("a live lease cannot be taken over", (await claim(key, randomUUID(), 60_000)) === false);

    // 3) A foreign release must not free someone else's claim.
    await release(key, randomUUID());
    const stillHeld = await prisma.ttsCacheClaim.findUnique({ where: { cacheKey: key } });
    check("releasing another worker's claim does nothing", stillHeld?.ownerId === holder, stillHeld);

    // 4) An EXPIRED lease is stealable, so a worker that died cannot wedge the phrase forever.
    await prisma.ttsCacheClaim.update({
      where: { cacheKey: key },
      data: { leaseUntil: new Date(Date.now() - 1_000) }
    });
    const successor = randomUUID();
    check("an expired lease is taken over", (await claim(key, successor, 60_000)) === true);
    const afterTakeover = await prisma.ttsCacheClaim.findUnique({ where: { cacheKey: key } });
    check("the takeover records the new owner", afterTakeover?.ownerId === successor, afterTakeover);

    // 5) Only two workers may ever hold it across the takeover — the original holder's release is
    //    now a no-op, which is why release() is owner-scoped.
    await release(key, holder);
    const afterStaleRelease = await prisma.ttsCacheClaim.findUnique({ where: { cacheKey: key } });
    check("a superseded owner cannot release the new owner's claim", afterStaleRelease?.ownerId === successor, afterStaleRelease);

    // 6) The rightful owner releases, and the key is immediately claimable again.
    await release(key, successor);
    check("the owner's release frees the key", (await prisma.ttsCacheClaim.findUnique({ where: { cacheKey: key } })) === null);
    check("a freed key is claimable again", (await claim(key, randomUUID(), 60_000)) === true);
  } finally {
    await prisma.ttsCacheClaim.deleteMany({ where: { cacheKey: { startsWith: "test-" } } });
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.map((name) => `  - ${name}`).join("\n"));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
