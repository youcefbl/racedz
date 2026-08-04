import { randomUUID } from "crypto";
import { readdir, rm } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { synthesizeSpeech } from "@/lib/coach/tts";

// FD1-R02 / F234-R02: the TTS cost boundary — one paid call per cache key, a quota that cannot be
// overshot, and a cache that is never observable half-written.
//
// This drives the PRODUCTION function (`synthesizeSpeech`) with an injected synthesizer that counts
// calls, rather than re-implementing its claim SQL in the test. An earlier version of this suite
// copied the SQL and so could not have caught a defect in the function itself (review F234-R06).
// No OpenAI request is made: the injected synthesizer is the only thing that "produces" audio.

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

const CACHE_ROOT = path.join(process.cwd(), "public", "uploads", "tts-cache");
const MODEL = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";

/** A synthesizer that counts calls and can be made slow, so overlap is real rather than assumed. */
function countingSynthesizer(delayMs = 0) {
  const state = { calls: 0 };
  return {
    state,
    fn: async () => {
      state.calls += 1;
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return Buffer.from(`audio-${state.calls}`);
    }
  };
}

async function usageRows(userId: string) {
  return prisma.$queryRaw<Array<{ status: string; errorCode: string | null }>>`
    SELECT "status"::text AS "status", "errorCode" FROM "AiUsageLog" WHERE "userId" = ${userId}
  `;
}

async function main() {
  console.log("\nTTS cost boundary — production synthesizeSpeech() with a counted provider\n");

  const user = await prisma.user.create({
    data: {
      email: `tts-claim-${randomUUID()}@example.test`,
      firstName: "TTS",
      lastName: "Tester",
      role: "RUNNER",
      emailVerifiedAt: new Date()
    },
    select: { id: true }
  });

  const written: string[] = [];

  try {
    // 1) Same cache key, many concurrent misses: exactly ONE paid call, and everyone gets audio.
    const phrase = `Test cue ${randomUUID()}`;
    written.push(phrase);
    const single = countingSynthesizer(400);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => synthesizeSpeech(phrase, "en", user.id, { synthesize: single.fn }))
    );
    check("a contested cache key costs exactly one provider call", single.state.calls === 1, single.state.calls);
    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Buffer>[];
    check("every caller either got audio or was told to retry", results.length === 6 && fulfilled.length >= 1, {
      fulfilled: fulfilled.length,
      rejected: results.length - fulfilled.length
    });
    check(
      "callers that got audio all got the SAME bytes",
      new Set(fulfilled.map((r) => r.value.toString())).size === 1,
      fulfilled.map((r) => r.value.toString())
    );

    // 2) Publication is atomic: no partially written file is left behind or exposed.
    const localeDir = path.join(CACHE_ROOT, "en");
    const stray = (await readdir(localeDir).catch(() => [])).filter((name) => name.endsWith(".part"));
    check("no partially written cache file remains", stray.length === 0, stray);

    // 3) A second request for the same phrase is served from cache — no further provider call.
    const cachedRun = countingSynthesizer();
    const fromCache = await synthesizeSpeech(phrase, "en", user.id, { synthesize: cachedRun.fn });
    check("a cached phrase costs no provider call", cachedRun.state.calls === 0, cachedRun.state.calls);
    check("the cached bytes are the published ones", fromCache.toString() === "audio-1", fromCache.toString());

    // 4) Exactly one usage row was billed for all of that, and nothing is left PENDING.
    const rows = await usageRows(user.id);
    const succeeded = rows.filter((r) => r.status === "SUCCEEDED").length;
    const pending = rows.filter((r) => r.status === "PENDING").length;
    check("one billed usage row for one provider call", succeeded === 1, rows);
    check("no reservation is left PENDING", pending === 0, rows);

    // 5) An ABANDONED reservation (a worker killed after reserving) must not keep consuming quota.
    //    Inserted older than the lease, it is reconciled on the next attempt instead of counted.
    await prisma.$executeRaw`
      INSERT INTO "AiUsageLog" ("id", "userId", "model", "status", "createdAt")
      VALUES (${randomUUID()}, ${user.id}, ${MODEL}, 'PENDING', NOW() - INTERVAL '30 minutes')
    `;
    const afterCrash = `Test cue ${randomUUID()}`;
    written.push(afterCrash);
    const recovery = countingSynthesizer();
    await synthesizeSpeech(afterCrash, "en", user.id, { synthesize: recovery.fn });
    const reconciled = (await usageRows(user.id)).filter((r) => r.errorCode === "RESERVATION_ABANDONED").length;
    check("a stale reservation is reconciled, not counted forever", reconciled === 1, reconciled);
    check("work continues after a killed worker", recovery.state.calls === 1, recovery.state.calls);

    // 6) A provider failure is recorded as FAILED and leaves nothing claimed, so the next attempt
    //    can proceed rather than meeting a wedged key.
    const failing = `Test cue ${randomUUID()}`;
    written.push(failing);
    await synthesizeSpeech(failing, "en", user.id, {
      synthesize: async () => {
        throw new Error("provider exploded");
      }
    }).catch(() => undefined);
    const failedRows = (await usageRows(user.id)).filter((r) => r.status === "FAILED" && r.errorCode !== "RESERVATION_ABANDONED");
    check("a provider failure is recorded as FAILED", failedRows.length === 1, failedRows);
    const claimsLeft = await prisma.ttsCacheClaim.count();
    check("a failed synthesis leaves no claim behind", claimsLeft === 0, claimsLeft);

    const retry = countingSynthesizer();
    await synthesizeSpeech(failing, "en", user.id, { synthesize: retry.fn });
    check("the phrase can be retried after a failure", retry.state.calls === 1, retry.state.calls);
  } finally {
    // Remove only the cache files this run created.
    const localeDir = path.join(CACHE_ROOT, "en");
    const { createHash } = await import("crypto");
    for (const phrase of written) {
      const key = createHash("sha256").update(`en::${phrase}`).digest("hex");
      await rm(path.join(localeDir, `${key}.mp3`), { force: true });
    }
    await prisma.$executeRaw`DELETE FROM "AiUsageLog" WHERE "userId" = ${user.id}`;
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
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
