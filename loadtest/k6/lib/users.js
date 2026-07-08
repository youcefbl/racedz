import { SharedArray } from "k6/data";

// Loaded once and shared across all VUs (memory-efficient). Produced by
// loadtest/seed/harvest-cookies.mjs. If this throws "cannot open ../data/users.json",
// you haven't run the harvester yet.
export const users = new SharedArray("users", () => JSON.parse(open("../data/users.json")));

// Map a globally-unique VU id to a distinct account, so each virtual user has
// its own identity (important: the app's rate limits are per-user).
export function userFor(id) {
  if (users.length === 0) throw new Error("No harvested users — run harvest-cookies.mjs first.");
  return users[id % users.length];
}
