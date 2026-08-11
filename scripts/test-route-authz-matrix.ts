/**
 * SEC-004: the route authorization matrix, as an executable control.
 *
 * The gate asks for a "route/object authorization matrix". A document would be accurate on the day
 * it was written and wrong by the next route. This derives the matrix from the source instead, and
 * fails when a route does not carry the guard its location implies — so the realistic future
 * mistake (someone adds `src/app/api/admin/thing/route.ts` and forgets the role check) is caught by
 * the test suite rather than by an attacker.
 *
 * Deliberately a STATIC check, not a runtime one. It cannot prove a guard is correct — that is what
 * test-authz-objects.ts and test-authz-roles.ts do by actually calling things — but it can prove no
 * route is missing one entirely, across every route at once, forever. The two kinds of coverage
 * answer different questions and neither replaces the other.
 *
 * A route with no guard must be listed in PUBLIC_ROUTES with a reason. That list is the point of
 * review: adding to it should feel like a decision, because it is one.
 *
 *   npm run test:route-authz
 */
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const API_ROOT = path.join(process.cwd(), "src", "app", "api");

/** Guards recognised as "this route authenticates/authorizes its caller". */
const GUARD_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "requireMobileUser", pattern: /requireMobileUser/ },
  { name: "optionalMobileUser", pattern: /optionalMobileUser/ },
  { name: "requireApprovedOrganizer", pattern: /requireApprovedOrganizer/ },
  { name: "requireAdmin", pattern: /requireAdmin/ },
  { name: "role-check", pattern: /session\??\.\s*user\??\.\s*role/ },
  { name: "auth()", pattern: /\bauth\(\)/ },
  { name: "cron-secret", pattern: /CRON_SECRET|cronSecret/ },
];

/**
 * Routes that are unauthenticated ON PURPOSE, each with the reason it is safe.
 *
 * Every entry is either a credential-exchange endpoint (the request body carries the credential
 * being verified, so there is nothing to authenticate first) or genuinely public data.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  "auth/[...nextauth]/route.ts": "Auth.js handler — owns the sign-in exchange itself",
  "auth/native/google/route.ts": "verifies the posted Google idToken against our client ID; the token is the credential",
  "races/route.ts": "public race listing",
  "races/[id]/route.ts": "public race detail",
  "races/[id]/categories/route.ts": "public race categories",
  "v1/races/route.ts": "public race listing (mobile)",
  "v1/config/route.ts": "public app config / kill switches, read before sign-in",
  "v1/auth/login/route.ts": "credential exchange",
  "v1/auth/register/route.ts": "account creation",
  "v1/auth/refresh/route.ts": "the refresh token in the body is the credential",
  "v1/auth/logout/route.ts": "the refresh token in the body is the credential being revoked",
  "v1/auth/token/route.ts": "PKCE code exchange — the code plus verifier is the credential",
  "v1/auth/resend-verification/route.ts": "pre-verification by definition; rate-limited",
};

/**
 * Routes under an area whose guard is deliberately not the area's usual one.
 *
 * Narrower than PUBLIC_ROUTES — these ARE guarded, just differently — and kept explicit so the
 * area rules can stay strict for everything else.
 */
const AREA_EXCEPTIONS: Record<string, string> = {
  "v1/auth/authorize/route.ts":
    "OAuth authorization endpoint, opened in the system browser: the caller is a cookie session, not a bearer token — there is no token yet, minting one is what it is for",
};

/** What each area MUST use, beyond merely having some guard. */
const AREA_RULES: Array<{ prefix: string; requires: string[]; label: string }> = [
  { prefix: "admin/", requires: ["requireAdmin", "role-check"], label: "admin routes must check the role" },
  { prefix: "organizer/", requires: ["requireApprovedOrganizer"], label: "organizer routes must resolve an approved organization" },
  { prefix: "internal/cron/", requires: ["cron-secret"], label: "cron routes must verify the shared secret" },
  { prefix: "v1/", requires: ["requireMobileUser", "optionalMobileUser"], label: "mobile routes must use a bearer guard" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

let passed = 0;
let failed = 0;
const check = (label: string, cond: boolean, detail: string) => {
  if (!cond) {
    console.log(`  FAIL  ${label} — ${detail}`);
    failed += 1;
  } else {
    passed += 1;
  }
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out.sort();
}

const rows: Array<{ route: string; methods: string; guards: string; note: string }> = [];

for (const file of walk(API_ROOT)) {
  const relative = path.relative(API_ROOT, file).split(path.sep).join("/");
  const source = readFileSync(file, "utf8");

  const methods = HTTP_METHODS.filter((method) =>
    new RegExp(`export\\s+(?:const|async\\s+function)\\s+${method}\\b`).test(source)
  );
  const guards = GUARD_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name);
  const isPublic = relative in PUBLIC_ROUTES;

  check(
    `${relative} has a guard or is declared public`,
    guards.length > 0 || isPublic,
    "no recognised guard and not in PUBLIC_ROUTES — add a guard, or list it with the reason it is safe"
  );

  // A route cannot be both: an entry in PUBLIC_ROUTES that has since grown a guard is a stale
  // exemption, and a stale exemption is how a route quietly loses its protection later.
  if (isPublic && guards.length > 0) {
    check(
      `${relative} is not a stale public exemption`,
      false,
      `listed as public but now uses ${guards.join("+")} — remove it from PUBLIC_ROUTES`
    );
  }

  for (const rule of AREA_RULES) {
    if (!relative.startsWith(rule.prefix) || isPublic || relative in AREA_EXCEPTIONS) continue;
    check(
      `${relative}: ${rule.label}`,
      guards.some((guard) => rule.requires.includes(guard)),
      `uses [${guards.join("+") || "nothing"}], expected one of [${rule.requires.join(", ")}]`
    );
  }

  rows.push({
    route: relative.replace(/\/route\.ts$/, "") || "/",
    methods: methods.join(",") || "—",
    guards: guards.join("+") || "PUBLIC",
    note: isPublic ? PUBLIC_ROUTES[relative] : (AREA_EXCEPTIONS[relative] ?? ""),
  });
}

console.log("\nRoute authorization matrix (SEC-004)\n");
const width = Math.max(...rows.map((row) => row.route.length));
for (const row of rows) {
  console.log(`  ${row.route.padEnd(width)}  ${row.methods.padEnd(18)}  ${row.guards}${row.note ? `  — ${row.note}` : ""}`);
}

console.log(`\n${rows.length} routes checked · ${passed} assertions passed, ${failed} failed`);
if (failed > 0) process.exit(1);
