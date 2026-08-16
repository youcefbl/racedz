import assert from "node:assert/strict";
import { encodeSyncCursor, parseSyncCursor } from "../src/lib/api/v1/sync-cursor";

// Compound delta cursor: rows sharing an updatedAt must not be skipped between pages.
const t = new Date("2026-08-16T10:00:00.000Z");
assert.equal(encodeSyncCursor(null), null);
assert.equal(encodeSyncCursor({ updatedAt: t, id: null }), t.toISOString());
assert.equal(encodeSyncCursor({ updatedAt: t, id: "run-b" }), `${t.toISOString()}|run-b`);

const compound = parseSyncCursor(`${t.toISOString()}|run-b`)!;
assert.equal(compound.updatedAt.getTime(), t.getTime());
assert.equal(compound.id, "run-b");

// Older clients send the bare timestamp: still accepted, no id.
const bare = parseSyncCursor(t.toISOString())!;
assert.equal(bare.updatedAt.getTime(), t.getTime());
assert.equal(bare.id, null);

assert.equal(parseSyncCursor(null), null);
assert.throws(() => parseSyncCursor("not-a-date|x"));
console.log("sync-cursor OK");
