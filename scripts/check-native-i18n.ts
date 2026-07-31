/**
 * Translation-parity gate for the native Android app's string resources.
 *
 * The web dictionaries already have `check:i18n`; this is the same guarantee for
 * `native-android/**\/src/main/res/values*\/strings.xml`. Without it, a missing Arabic or French
 * entry is invisible — Android silently falls back to the English value, so the screen renders
 * fine and the gap only surfaces when a user notices one untranslated line.
 *
 *   npm run check:native-i18n
 */
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import path from "path";

const NATIVE_ROOT = path.join(process.cwd(), "native-android");
const LOCALES = ["values", "values-fr", "values-ar"] as const;
const BASE = "values";

type LocaleDir = (typeof LOCALES)[number];

function findStringFiles(locale: LocaleDir): string[] {
  const found: string[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    for (const entry of readdirSync(dir)) {
      // Skip build output and Gradle caches — they contain merged copies that would double-count.
      if (entry === "build" || entry === ".gradle" || entry === ".kotlin") continue;
      const full = path.join(dir, entry);
      if (!statSync(full).isDirectory()) continue;

      const candidate = path.join(full, "src", "main", "res", locale, "strings.xml");
      if (existsSync(candidate)) found.push(candidate);
      walk(full, depth + 1);
    }
  };

  walk(NATIVE_ROOT, 0);
  return found;
}

function readNames(files: string[]): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    const xml = readFileSync(file, "utf8");
    for (const match of xml.matchAll(/<string\s+name="([^"]+)"/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

function main() {
  if (!existsSync(NATIVE_ROOT)) {
    console.log("native-android/ not present — skipping native i18n parity check.");
    return;
  }

  const byLocale = new Map<LocaleDir, Set<string>>();
  for (const locale of LOCALES) {
    byLocale.set(locale, readNames(findStringFiles(locale)));
  }

  const base = byLocale.get(BASE)!;
  const problems: string[] = [];

  for (const locale of LOCALES) {
    if (locale === BASE) continue;
    const names = byLocale.get(locale)!;

    const missing = [...base].filter((name) => !names.has(name)).sort();
    // An extra key is just as much a bug: it is dead weight that no screen can reach, and it
    // usually means a string was renamed in English and the translation was left behind.
    const extra = [...names].filter((name) => !base.has(name)).sort();

    if (missing.length) problems.push(`${locale}: missing ${missing.length} — ${missing.join(", ")}`);
    if (extra.length) problems.push(`${locale}: unused ${extra.length} — ${extra.join(", ")}`);
  }

  if (problems.length) {
    console.error("Native i18n parity FAILED:\n" + problems.map((line) => `  ${line}`).join("\n"));
    process.exit(1);
  }

  console.log(`Native i18n parity OK — ${base.size} keys consistent across en, fr, ar.`);
}

main();
