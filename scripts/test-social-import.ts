import assert from "node:assert/strict";
import type { ExtractedRace } from "../src/lib/social-import/extract";
import { normalizeExtractedRace, normalizeWilaya } from "../src/lib/social-import/normalize";

const now = new Date(2026, 6, 29, 12, 0, 0);

function race(overrides: Partial<ExtractedRace> = {}): ExtractedRace {
  return {
    isRace: true,
    title: "Course test",
    description: "Une course de test.",
    raceType: "ROAD",
    startDate: "2026-09-12",
    startTime: "08:00",
    registrationCloseAt: "2026-09-10",
    wilaya: "Bejaia",
    city: "Bejaia",
    commune: null,
    address: null,
    organizerName: null,
    organizerUrl: null,
    contactPhone: null,
    contactEmail: null,
    baridiMobNumber: null,
    ccpAccount: null,
    ccpKey: null,
    maxParticipants: null,
    elevationGainText: null,
    categories: [{ name: "5 km", distanceKm: 5, priceDzd: 0, startTime: "08:00" }],
    confidence: "high",
    notes: null,
    ...overrides
  };
}

assert.equal(normalizeWilaya("wilaya de Béjaïa"), "Bejaia");

const complete = normalizeExtractedRace(race(), "", now);
assert.deepEqual(complete.reviewWarnings, []);
assert.equal(complete.categories[0]?.priceDzd, 0, "free categories must retain a zero price");
assert.equal(complete.startDate.getFullYear(), 2026);
assert.equal(complete.startDate.getMonth(), 8);
assert.equal(complete.startDate.getDate(), 12);

const missing = normalizeExtractedRace(race({ title: null, startDate: null, wilaya: null, city: null, categories: [] }), "", now);
assert.equal(missing.title, "Imported race (draft)");
assert.equal(missing.wilaya, "Alger");
assert.equal(missing.categories[0]?.distanceKm, 10);
const expectedPlaceholder = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
expectedPlaceholder.setHours(8, 0, 0, 0);
assert.equal(missing.startDate.getTime(), expectedPlaceholder.getTime());
assert.ok(missing.reviewWarnings.some((warning) => warning.includes("Race name")));
assert.ok(missing.reviewWarnings.some((warning) => warning.includes("Race date")));
assert.ok(missing.reviewWarnings.some((warning) => warning.includes("Wilaya")));
assert.ok(missing.reviewWarnings.some((warning) => warning.includes("distance")));

const invalidCalendarDate = normalizeExtractedRace(race({ startDate: "2026-02-31" }), "", now);
assert.equal(invalidCalendarDate.startDateWasMissing, true, "rolled-over calendar dates must not be accepted");

const duplicateDistance = normalizeExtractedRace(race({
  categories: [
    { name: "10K", distanceKm: 10, priceDzd: 1500, startTime: null },
    { name: "Ten kilometres", distanceKm: 10, priceDzd: 2000, startTime: null }
  ]
}), "", now);
assert.equal(duplicateDistance.categories.length, 1, "duplicate extracted distances should collapse to one category");

const lateDeadline = normalizeExtractedRace(race({ registrationCloseAt: "2026-09-13" }), "", now);
assert.ok(lateDeadline.reviewWarnings.some((warning) => warning.includes("on or after race start")));

console.info("social import normalization tests passed");
