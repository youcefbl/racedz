#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";

const DEFAULT_START = "a18e9b9db1f8921c6e2a5f21710dc4f65d8c13be";
const EVIDENCE_FILE = "coach_review_fable_codex.md";

// These files implement or store the review protocol itself. A commit that changes only this set is
// review metadata and is exempt; otherwise recording a review would create an infinite succession
// of review-only commits that each need another review. Any commit that also changes product,
// operations, tracker, dependency, or workflow files remains reviewable.
const REVIEW_METADATA_PATHS = new Set([
  EVIDENCE_FILE,
  ".githooks/post-commit",
  ".githooks/pre-push",
  "scripts/check-commit-review-coverage.mjs"
]);

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function isAncestor(ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: process.cwd(),
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function changedPaths(commit) {
  const output = git(["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", commit]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function isReviewMetadataOnly(commit) {
  const paths = changedPaths(commit);
  return paths.length > 0 && paths.every((path) => REVIEW_METADATA_PATHS.has(path));
}

function evidenceAt(head, useWorktree) {
  if (useWorktree) return readFileSync(EVIDENCE_FILE, "utf8");
  return git(["show", `${head}:${EVIDENCE_FILE}`]);
}

function main() {
  const head = optionValue("--head", "HEAD");
  const start = optionValue("--start", DEFAULT_START);
  const warnOnly = hasFlag("--warn-only");
  const useWorktree = hasFlag("--worktree");

  // Resolve both refs up front. This also makes malformed/unfetched refs fail with a concise error.
  const fullHead = git(["rev-parse", "--verify", `${head}^{commit}`]);
  const fullStart = git(["rev-parse", "--verify", `${start}^{commit}`]);

  if (!isAncestor(fullStart, fullHead)) {
    console.log(`Commit review coverage: ${fullHead.slice(0, 7)} is outside the tracked history starting at ${fullStart.slice(0, 7)}; skipped.`);
    return;
  }

  const evidence = evidenceAt(fullHead, useWorktree);
  const reviewed = new Set(
    [...evidence.matchAll(/<!--\s*commit-review:\s*([0-9a-f]{40})\s*-->/gi)].map((match) => match[1].toLowerCase())
  );
  const commits = git(["rev-list", "--reverse", `${fullStart}^..${fullHead}`])
    .split("\n")
    .filter(Boolean);

  const missing = commits.filter((commit) => !isReviewMetadataOnly(commit) && !reviewed.has(commit.toLowerCase()));
  const exemptCount = commits.filter(isReviewMetadataOnly).length;

  if (missing.length === 0) {
    console.log(
      `Commit review coverage: ${commits.length - exemptCount} reviewable commit(s) covered from ${fullStart.slice(0, 7)} through ${fullHead.slice(0, 7)}; ${exemptCount} review-metadata commit(s) exempt.`
    );
    return;
  }

  const details = missing.map((commit) => {
    const subject = git(["show", "-s", "--format=%s", commit]);
    return `  - ${commit}  ${subject}`;
  });
  const message = [
    `Commit review coverage: ${missing.length} unreviewed commit(s) found.`,
    ...details,
    "",
    `Review each commit, update ${EVIDENCE_FILE}, and add this exact marker beside its review section:`,
    "  <!-- commit-review: <full-40-character-commit-sha> -->",
    "",
    "Incidental SHA mentions and remediation evidence do not count. Commits changing only the review protocol files are exempt."
  ].join("\n");

  if (warnOnly) {
    console.warn(message);
    return;
  }

  console.error(message);
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Commit review coverage could not run: ${message}`);
  console.error("Ensure the repository history is available and run from the ZidRun repository root.");
  process.exitCode = 2;
}
