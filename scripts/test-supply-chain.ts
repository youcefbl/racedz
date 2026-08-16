/**
 * Supply-chain and release-integrity invariants (`SEC-012`).
 *
 * The gate asks for "green `npm audit`, lockfile/dependency/security/secret scanning, and no
 * source-map or debug artifact publication". Those are one-off commands a person runs and forgets;
 * this file is the version that runs on every commit, because a clean audit last Tuesday says
 * nothing about the dependency added on Wednesday.
 *
 * Each check below is an assertion about the repository as it stands, not about the tooling around
 * it — so it holds whether or not CI is configured, which matters here: the owner decision of
 * 2026-08-09 is that remote CI is NOT a release gate for this project, and the local suite is.
 *
 *   npm run test:supply-chain
 */
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const problems: string[] = [];
const notes: string[] = [];

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// ---- 1. No known-vulnerable dependencies ------------------------------------------------------
// Production dependencies are the release gate; dev-only advisories are reported but do not fail,
// because a vulnerable test runner never reaches a runner's browser and blocking on it teaches
// people to pass --force.
{
  const raw = execFileSync("npm", ["audit", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const report = JSON.parse(raw) as {
    vulnerabilities?: Record<string, { severity: string; isDirect: boolean; via: unknown[] }>;
    metadata?: { vulnerabilities?: Record<string, number> };
  };
  const blocking = Object.entries(report.vulnerabilities ?? {}).filter(([, v]) =>
    v.severity === "critical" || v.severity === "high"
  );
  const counts = report.metadata?.vulnerabilities ?? {};
  if (blocking.length > 0) {
    for (const [name, v] of blocking) problems.push(`npm audit: ${v.severity} advisory in "${name}"`);
  }
  notes.push(
    `npm audit: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ` +
      `${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low`
  );
}

// ---- 2. The lockfile is real and pinned -------------------------------------------------------
// "Pin and audit dependencies" is only true if the lockfile is committed AND carries integrity
// hashes. A lockfile without them pins a version number but not the bytes behind it, which is the
// half that actually defends against a compromised registry entry.
{
  const lockPath = path.join(ROOT, "package-lock.json");
  if (!existsSync(lockPath)) {
    problems.push("package-lock.json is missing — dependency versions are not pinned at all");
  } else {
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
      lockfileVersion?: number;
      packages?: Record<string, { resolved?: string; integrity?: string; link?: boolean; dev?: boolean }>;
    };
    if ((lock.lockfileVersion ?? 0) < 2) {
      problems.push(`package-lock.json is lockfileVersion ${lock.lockfileVersion} — v2+ is needed for integrity hashes`);
    }
    const registryPackages = Object.entries(lock.packages ?? {}).filter(
      ([name, entry]) => name !== "" && !entry.link && entry.resolved?.startsWith("http")
    );
    const unhashed = registryPackages.filter(([, entry]) => !entry.integrity);
    if (unhashed.length > 0) {
      problems.push(`${unhashed.length} locked packages carry no integrity hash (e.g. ${unhashed[0][0]})`);
    }
    notes.push(`lockfile: v${lock.lockfileVersion}, ${registryPackages.length} registry packages, all integrity-hashed`);

    // A dependency resolved from anywhere other than the public registry is not necessarily wrong,
    // but it is never accidental — so it has to be seen rather than discovered during an incident.
    const offRegistry = registryPackages.filter(([, e]) => !e.resolved!.startsWith("https://registry.npmjs.org/"));
    for (const [name, entry] of offRegistry) {
      problems.push(`"${name}" resolves from outside the public registry: ${new URL(entry.resolved!).host}`);
    }
  }
}

// ---- 2b. The INSTALLED tree matches the lockfile ----------------------------------------------
// A committed lockfile only guarantees reproducibility if the build actually installed from it. The
// audit that added this check found the tree had silently drifted — brace-expansion 5.0.8 where the
// lockfile said 5.0.9, fast-uri 3.1.4 where it said 3.1.5 — which means a release built from this
// machine would not have been the dependency set the lockfile claims was reviewed. Dev-tree only in
// that instance, and harmless, but "which bytes shipped" is exactly the question SEC-012 exists to
// answer, and "close enough" is not an answer. `npm ci` is the fix when this fails.
{
  let lsOutput = "";
  try {
    lsOutput = execFileSync("npm", ["ls", "--all", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch (error) {
    // npm exits non-zero precisely WHEN there are problems, so the failure path is the interesting
    // one and its stdout still carries the report.
    lsOutput = (error as { stdout?: string }).stdout ?? "";
  }
  if (!lsOutput.trim()) {
    problems.push("could not read the installed dependency tree (`npm ls --all --json` produced nothing)");
  } else {
    const tree = JSON.parse(lsOutput) as { problems?: string[] };
    const drift = (tree.problems ?? []).filter((p) => /invalid|missing|extraneous/i.test(p));
    if (drift.length > 0) {
      problems.push(
        `node_modules does not match package-lock.json (${drift.length} problems) — run \`npm ci\`. First: ${drift[0]}`
      );
    } else {
      notes.push("installed tree matches the lockfile");
    }
  }
}

// ---- 3. No secrets committed ------------------------------------------------------------------
// Scans TRACKED files only. Anything gitignored is by definition not what we ship, and scanning the
// working tree instead would trip on the developer's own .env every single run — a check that cries
// wolf gets disabled, and a disabled check protects nobody.
{
  const tracked = git("ls-files", "-z").split("\0").filter(Boolean);

  const ENV_LIKE = /(^|\/)\.env($|\.)|(^|\/)[^/]*\.env$/;
  const KEY_LIKE = /\.(pem|p12|pfx|jks|keystore)$/i;
  for (const file of tracked) {
    if (ENV_LIKE.test(file) && !/\.example$/.test(file)) problems.push(`env file is committed: ${file}`);
    if (KEY_LIKE.test(file)) problems.push(`key material is committed: ${file}`);
  }

  // Value shapes that are secret wherever they appear. Deliberately narrow: a generic "long random
  // string" rule matches minified assets, lockfile hashes and base64 images, and the resulting
  // noise is what makes people stop reading the output.
  const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
    { label: "private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
    { label: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
    { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
    { label: "OpenAI key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
    { label: "Resend key", pattern: /\bre_[A-Za-z0-9_-]{20,}\b/ },
    { label: "Slack token", pattern: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/ },
    { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
    { label: "JWT with a payload", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./ }
  ];

  const SCANNABLE = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|ya?ml|env|example|sh|sql|kt|gradle|xml|properties|conf|Caddyfile)$/i;
  for (const file of tracked) {
    if (file === "package-lock.json" || file.startsWith("node_modules/")) continue;
    if (!SCANNABLE.test(file) && !/(^|\/)(Dockerfile|Caddyfile)/.test(file)) continue;
    const full = path.join(ROOT, file);
    if (!existsSync(full)) continue; // deleted but still staged
    const source = readFileSync(full, "utf8");
    for (const { label, pattern } of SECRET_PATTERNS) {
      const match = source.match(pattern);
      if (!match) continue;
      // The finding names the file and the KIND of secret, never the value — this output goes into
      // terminals, CI logs and possibly a paste into an issue.
      const line = source.slice(0, match.index ?? 0).split(/\r?\n/).length;
      problems.push(`${file}:${line}: looks like a committed ${label}`);
    }
  }
  notes.push(`secret scan: ${tracked.length} tracked files`);
}

// ---- 4. Nothing that would ship the source back to an attacker --------------------------------
// Source maps turn a minified bundle back into readable code, including anything a developer
// assumed was hidden in it. Sentry needs them at BUILD time and deletes them after upload; the
// failure here would be enabling browser source maps in the Next config, which publishes them.
{
  const config = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
  if (/productionBrowserSourceMaps\s*:\s*true/.test(config)) {
    problems.push("next.config.ts sets productionBrowserSourceMaps: true — production source maps would be published");
  }
  if (!/deleteSourcemapsAfterUpload\s*:\s*true/.test(config)) {
    problems.push("next.config.ts no longer deletes source maps after the Sentry upload");
  }
  if (!/poweredByHeader\s*:\s*false/.test(config)) {
    problems.push("next.config.ts no longer disables the x-powered-by header");
  }
  notes.push("build config: no published source maps, no framework banner");
}

// ---- 5. No secret reachable from the client bundle --------------------------------------------
// Every NEXT_PUBLIC_* value is compiled into JavaScript the browser downloads. The name is the only
// thing standing between "config" and "credential", so the naming has to be checked, not trusted.
{
  const SECRET_WORD = /(SECRET|PRIVATE|TOKEN|PASSWORD|CREDENTIAL|_KEY$|APIKEY|API_KEY)/i;
  // Publishable-by-design identifiers, each with the reason it is safe in a browser bundle. The
  // list is the review surface: adding a name here is a claim someone has to defend, which is a
  // much better failure mode than a rule quietly loose enough to let a real key through.
  const ALLOWED: Record<string, string> = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "the PUBLIC half of the web-push keypair; the private half never leaves the server",
    NEXT_PUBLIC_FIREBASE_API_KEY:
      "Firebase web API keys identify the project, they do not authenticate the caller — Google publishes them in its own web snippets and access is enforced by Security Rules, not by this value",
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: "the PUBLIC VAPID key passed to getToken() for web push"
  };
  const seen = new Set<string>();
  for (const file of git("ls-files", "-z", "src", "*.ts", "*.tsx", "*.mjs").split("\0").filter(Boolean)) {
    const full = path.join(ROOT, file);
    if (!existsSync(full)) continue;
    for (const match of readFileSync(full, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) seen.add(match[0]);
  }
  for (const name of seen) {
    if (name in ALLOWED) continue;
    if (SECRET_WORD.test(name)) {
      problems.push(`${name} is compiled into the client bundle but is named like a secret`);
    }
  }
  notes.push(`client env: ${seen.size} NEXT_PUBLIC_* names, none secret-shaped`);
}

// ---- 6. Migrations are reviewable -------------------------------------------------------------
// "Review Prisma migrations/raw SQL" needs the migrations to be IN the repo to be reviewable at all.
// A schema change applied straight to production leaves nothing to review and nothing to roll back.
{
  const migrations = path.join(ROOT, "prisma", "migrations");
  if (!existsSync(migrations)) {
    problems.push("prisma/migrations is missing — schema changes are not under review or rollback control");
  } else {
    const count = git("ls-files", "prisma/migrations").split("\n").filter((l) => l.endsWith(".sql")).length;
    if (count === 0) problems.push("no committed migration SQL — schema history is not reviewable");
    else notes.push(`migrations: ${count} committed SQL files`);
  }
}

for (const note of notes) console.log(`  ok    ${note}`);

if (problems.length > 0) {
  console.error("\nSupply-chain check FAILED:\n");
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log("\nSupply-chain check passed.");
