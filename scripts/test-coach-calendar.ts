import { Prisma, PrismaClient } from "@prisma/client";
import { PRODUCT_TIME_ZONE, productDayEndAt, productDayStartAt } from "../src/lib/coach/calendar";

/*
 * The Algiers day boundary, exercised against a real Postgres because the whole point of these
 * expressions is what the *database* does with `AT TIME ZONE` on a naive column.
 *
 * `TrainingWorkout.scheduledFor` is `timestamp without time zone` holding UTC. Bounding a query on
 * `date_trunc('day', NOW())` bounds it by the *UTC* day, and Algeria is UTC+1: between 00:00 and
 * 00:59 local the UTC clock is still on yesterday's date. For that hour the query answered for the
 * wrong calendar day — hiding today's session and offering yesterday's as "today's workout".
 */

const prisma = new PrismaClient();
let checks = 0;
let failures = 0;

function ok(label: string, condition: boolean) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

/** Resolve the shipped bound expressions for a fixed instant, as the DB sees them. */
async function boundsAt(instantUtc: string): Promise<{ start: Date; end: Date }> {
  const now = Prisma.sql`${instantUtc}::timestamptz`;
  const rows = await prisma.$queryRaw<Array<{ start: Date; end: Date }>>`
    SELECT ${productDayStartAt(now)} AS start, ${productDayEndAt(now)} AS end
  `;
  return rows[0];
}

/** The naive-UTC timestamps the bounds are compared against read back as UTC ISO strings. */
const iso = (value: Date) => value.toISOString().replace(".000Z", "Z");

async function main() {
  const zone = await prisma.$queryRaw<Array<Record<string, string>>>`SHOW timezone`;
  console.log(`Coach calendar boundary — product zone ${PRODUCT_TIME_ZONE}, session zone ${Object.values(zone[0])[0]}`);

  // Algeria is UTC+1 year round, so local midnight is always 23:00 UTC the day before.
  const cases: Array<{ label: string; nowUtc: string; localDate: string }> = [
    { label: "23:59 local, still the old day", nowUtc: "2026-08-07T22:59:00Z", localDate: "2026-08-07" },
    { label: "00:00 local, the day flips", nowUtc: "2026-08-07T23:00:00Z", localDate: "2026-08-08" },
    { label: "00:59 local, the hour that used to break", nowUtc: "2026-08-07T23:59:00Z", localDate: "2026-08-08" },
    { label: "01:00 local, past the old UTC rollover", nowUtc: "2026-08-08T00:00:00Z", localDate: "2026-08-08" },
    { label: "midday local", nowUtc: "2026-08-08T11:00:00Z", localDate: "2026-08-08" },
    { label: "January, confirming Algeria has no DST", nowUtc: "2026-01-15T23:30:00Z", localDate: "2026-01-16" },
  ];

  for (const testCase of cases) {
    const { start, end } = await boundsAt(testCase.nowUtc);
    // Local midnight for `localDate` expressed as the UTC instant the column stores.
    const expectedStart = new Date(`${testCase.localDate}T00:00:00Z`).getTime() - 3600_000;
    const expectedEnd = expectedStart + 24 * 3600_000;
    ok(
      `${testCase.label}: window is the ${testCase.localDate} Algiers day (${iso(start)} → ${iso(end)})`,
      start.getTime() === expectedStart && end.getTime() === expectedEnd,
    );
  }

  // The regression itself: a session at 05:30 UTC on 8 Aug is "today" at 00:30 local on 8 Aug.
  const { start, end } = await boundsAt("2026-08-07T23:30:00Z");
  const session = new Date("2026-08-08T05:30:00Z");
  ok(
    "a 05:30 session on the new local day is inside the window at 00:30 local",
    session >= start && session < end,
  );
  const yesterdaySession = new Date("2026-08-07T06:00:00Z");
  ok(
    "yesterday's session is outside the window at 00:30 local",
    !(yesterdaySession >= start && yesterdaySession < end),
  );

  // What the old bound did at the same instant, kept as an executable record of the defect.
  const legacy = await prisma.$queryRaw<Array<{ start: Date; end: Date }>>`
    SELECT date_trunc('day', '2026-08-07T23:30:00Z'::timestamptz) AS start,
           date_trunc('day', '2026-08-07T23:30:00Z'::timestamptz) + INTERVAL '1 day' AS end
  `;
  ok(
    "the previous UTC-day bound would have excluded that session",
    !(session >= legacy[0].start && session < legacy[0].end),
  );

  console.log(`\n${checks} checks, ${failures} failed`);
  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
