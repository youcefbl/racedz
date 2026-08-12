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
// These server-owned dictionaries are rendered or spoken by the native Coach. Keep them under the
// same dialect gate as Android resources so a backend copy change cannot reintroduce dialect drift
// on the phone. The model prompt is intentionally excluded because it names forbidden forms as
// negative examples.
const NATIVE_ARABIC_COPY_FILES = [
  "src/lib/coach/audio-copy.ts",
  "src/lib/coach/provenance.ts",
  "src/lib/coach/reminders.ts",
  "src/lib/coach/safety.ts",
  "src/lib/coach/service.ts",
  "src/lib/coach/tts-allowlist.ts",
  "src/lib/coach/workout-i18n.ts",
  "src/lib/coach/workout-structure.ts",
].map((file) => path.join(process.cwd(), file));

type LocaleDir = (typeof LOCALES)[number];

type ForbiddenDialectForm = {
  pattern: RegExp;
  preferred: string;
};

/**
 * The Arabic locale is central-Algerian Darija (Algiers), not a generic Maghrebi mix. Keep this
 * list deliberately narrow: legal, medical, and technical labels may still use standard Arabic
 * when it is clearer, while these forms are known Moroccan/Tunisian drift in ZidRun's product
 * voice. The preferred forms match the glossary established by the 2026-08 native copy review.
 */
const FORBIDDEN_DIALECT_FORMS: ForbiddenDialectForm[] = [
  { pattern: /(?<!\p{L})ديال(?:ي|ك|و|ها|نا|كم|هم)?(?!\p{L})/u, preferred: "تاع" },
  { pattern: /(?<!\p{L})حيت(?!\p{L})/u, preferred: "على خاطر" },
  { pattern: /(?<!\p{L})غادي(?!\p{L})/u, preferred: "راح" },
  { pattern: /(?<!\p{L})دابا(?!\p{L})/u, preferred: "ضرك" },
  { pattern: /(?<!\p{L})تو[ّ]?ا(?!\p{L})/u, preferred: "ضرك" },
  { pattern: /نج[ّ]?م/u, preferred: "قدر" },
  { pattern: /صيفط/u, preferred: "ابعث" },
  { pattern: /(?<!\p{L})برش(?:ا|ة)(?!\p{L})/u, preferred: "بزاف" },
  { pattern: /(?<!\p{L})قد[ّ]?اش(?!\p{L})/u, preferred: "شحال" },
  { pattern: /(?<!\p{L})فم[ّ]?ا(?!\p{L})/u, preferred: "كاين" },
  { pattern: /(?<!\p{L})باهي(?!\p{L})/u, preferred: "مليح" },
  { pattern: /(?<!\p{L})يلزم(?:و|ها|هم)?(?!\p{L})/u, preferred: "لازم" },
  { pattern: /(?:تسالي|سالي)/u, preferred: "كمّل / حبس الجَرية" },
  { pattern: /كليكي/u, preferred: "اضغط" },
  { pattern: /مستن[ّ]?ي/u, preferred: "راني نستنا / رانا نستناو" },
  { pattern: /وجيعة/u, preferred: "وجع" },
  { pattern: /(?<!\p{L})مل[ّ]?ي(?!\p{L})/u, preferred: "كي" },
  { pattern: /(?<!\p{L})سك[ّ]?ر(?!\p{L})/u, preferred: "سدّ" },
  { pattern: /صحّة/u, preferred: "صحا" },
];

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

function findDialectDrift(files: string[]): string[] {
  const problems: string[] = [];

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const form of FORBIDDEN_DIALECT_FORMS) {
        const match = line.match(form.pattern);
        if (match) {
          problems.push(
            `${relative}:${index + 1}: found "${match[0]}"; use central-Algerian "${form.preferred}"`,
          );
        }
      }
    });
  }

  return problems;
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

  problems.push(
    ...findDialectDrift([
      ...findStringFiles("values-ar"),
      ...NATIVE_ARABIC_COPY_FILES.filter((file) => existsSync(file)),
    ]),
  );

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

  console.log(`Native i18n OK — ${base.size} keys consistent across en, fr, ar; Algiers-Darija drift gate passed.`);
}

main();
