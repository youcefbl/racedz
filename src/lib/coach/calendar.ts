import { Prisma } from "@prisma/client";

/**
 * The calendar the product's days are measured in.
 *
 * Algeria is a single zone at UTC+1 with no DST, so this is a constant rather than a per-runner
 * field. Anything that answers "today", "this week" or "was this missed" has to agree on it, or the
 * same session shows up under two different labels depending on which query answered.
 */
export const PRODUCT_TIME_ZONE = "Africa/Algiers";

/** Interpolated as a literal, not a bind parameter: `AT TIME ZONE $1` will not infer a type here. */
const ZONE = Prisma.raw(`'${PRODUCT_TIME_ZONE}'`);

/**
 * Bounds of the current [PRODUCT_TIME_ZONE] calendar day, as UTC-naive timestamps.
 *
 * `TrainingWorkout.scheduledFor` is `timestamp without time zone` holding UTC, so a bound has to be
 * expressed the same way for the comparison to mean anything. Convert the *bound*, never the column:
 * `scheduledFor AT TIME ZONE 'Africa/Algiers'` attaches a zone to a naive value and yields a
 * timestamptz, which then gets compared back through the session zone and comes out shifted — the
 * mistake documented at length in `api/v1/coach/plan/route.ts`, which once returned next Monday's
 * workout as part of this week.
 *
 * So: read now in Algiers wall-clock, truncate to that day, resolve it back to a real instant, and
 * express that instant as UTC. Doing the arithmetic in SQL keeps it independent of the server's own
 * timezone — the API server is UTC in production but need not be in development.
 *
 * The bug this exists to prevent: `date_trunc('day', NOW())` is the *UTC* day. Between 00:00 and
 * 00:59 Algiers local, UTC is still on the previous date, so a query bounded that way answers for
 * yesterday — hiding today's session and offering yesterday's as "today's workout" for the first
 * hour of every day.
 */
export function productDayStartAt(now: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((date_trunc('day', (${now} AT TIME ZONE ${ZONE})) AT TIME ZONE ${ZONE}) AT TIME ZONE 'UTC')`;
}

/** Exclusive upper bound matching [productDayStartAt] — the next calendar day's midnight. */
export function productDayEndAt(now: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(((date_trunc('day', (${now} AT TIME ZONE ${ZONE})) + interval '1 day') AT TIME ZONE ${ZONE}) AT TIME ZONE 'UTC')`;
}

/**
 * The `now` every caller uses. Taken from the database rather than the Node process so the answer
 * does not change with the API server's own clock or zone; tests inject a fixed instant instead.
 */
const NOW = Prisma.sql`NOW()`;

export const productDayStart = productDayStartAt(NOW);
export const productDayEnd = productDayEndAt(NOW);
