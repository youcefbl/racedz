/**
 * Guard against locale drift: every translation key present in one locale must exist in all of them.
 * Checks the main UI dictionary (src/lib/i18n.ts) and the coach copy (src/components/coach/copy.ts).
 * Exits non-zero (with a report of the missing paths) when any locale is out of parity. Wired into
 * `npm run lint` so a half-translated key fails the same gate as an eslint error.
 */
import { dictionaries, LOCALES } from "../src/lib/i18n";
import { getCoachCopy } from "../src/components/coach/copy";

type Dict = Record<string, unknown>;

// Collect the dotted path of every leaf (non-plain-object) value. Arrays and primitives are leaves;
// we only care that the KEY exists in every locale, not that the translated string differs.
function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  const out: string[] = [];
  for (const [key, child] of Object.entries(value as Dict)) {
    out.push(...leafPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

function diff(reference: Set<string>, candidate: Set<string>) {
  const missing = [...reference].filter((k) => !candidate.has(k));
  const extra = [...candidate].filter((k) => !reference.has(k));
  return { missing, extra };
}

function checkGroup(name: string, byLocale: Record<string, Set<string>>): string[] {
  const problems: string[] = [];
  // Use English as the reference set; report per-locale missing/extra against it.
  const reference = byLocale.en;
  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const { missing, extra } = diff(reference, byLocale[locale]);
    if (missing.length) problems.push(`  [${name}] ${locale} is MISSING ${missing.length}: ${missing.join(", ")}`);
    if (extra.length) problems.push(`  [${name}] ${locale} has EXTRA ${extra.length} (not in en): ${extra.join(", ")}`);
  }
  return problems;
}

const uiByLocale: Record<string, Set<string>> = {};
const coachByLocale: Record<string, Set<string>> = {};
for (const locale of LOCALES) {
  uiByLocale[locale] = new Set(leafPaths(dictionaries[locale]));
  coachByLocale[locale] = new Set(leafPaths(getCoachCopy(locale)));
}

const problems = [...checkGroup("i18n", uiByLocale), ...checkGroup("coach-copy", coachByLocale)];

if (problems.length) {
  console.error("i18n parity check FAILED:\n" + problems.join("\n"));
  process.exit(1);
}

console.log(
  `i18n parity OK — ${uiByLocale.en.size} UI keys + ${coachByLocale.en.size} coach keys consistent across ${LOCALES.join(", ")}.`
);
