// Single source of truth for the synthetic load-test user set, shared by the
// seeder (creates them in Postgres) and the cookie harvester (logs them in).
// Deterministic: user N always has the same email + password on both sides.

export const COUNT = Number(process.env.TEST_USER_COUNT || 1000);
export const PASSWORD = process.env.TEST_USER_PASSWORD || "LoadTest!2026";
export const DOMAIN = process.env.TEST_USER_DOMAIN || "zidrun.test";
export const PREFIX = process.env.TEST_USER_PREFIX || "loadtest";

export const pad = (n) => String(n).padStart(5, "0");
// Uses the "+tag" form so all test accounts share one mailbox and are trivially
// greppable / deletable (email LIKE 'loadtest+%@zidrun.test').
export const emailFor = (i) => `${PREFIX}+${pad(i)}@${DOMAIN}`;
