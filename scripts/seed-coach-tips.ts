import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

// Seeds curated coach tips from prisma/data/coach-tips.json into the database.
// Idempotent: skips any tip whose English text already exists, so it is safe to run
// repeatedly (e.g. on production) and to re-run after adding new tips to the JSON.
//
// Usage (against production, from the repo root):
//   DATABASE_URL="postgres://…prod…" npx tsx scripts/seed-coach-tips.ts
// Add --dry to preview without writing:
//   DATABASE_URL="…" npx tsx scripts/seed-coach-tips.ts --dry

const CATEGORIES = [
  "GENERAL",
  "BEGINNER",
  "INTERMEDIATE",
  "EXPERIENCED",
  "HEAVY_WEIGHT",
  "MARATHON",
  "SPEED",
  "TRAIL",
  "FITNESS",
  "INJURY_PRONE"
] as const;
type Category = (typeof CATEGORIES)[number];

type Tip = { en: string; fr: string; ar: string };
type TipsFile = Record<string, Tip[]>;

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry");

async function main() {
  const path = join(process.cwd(), "prisma/data/coach-tips.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as TipsFile;

  // Existing English texts, so we never insert a duplicate tip.
  const seen = new Set((await prisma.coachTip.findMany({ select: { textEn: true } })).map((row) => row.textEn));

  let inserted = 0;
  let skipped = 0;

  for (const [category, tips] of Object.entries(data)) {
    if (!CATEGORIES.includes(category as Category)) {
      throw new Error(`Unknown tip category "${category}". Allowed: ${CATEGORIES.join(", ")}`);
    }

    const fresh: Tip[] = [];
    for (const tip of tips) {
      const en = tip.en?.trim();
      const fr = tip.fr?.trim();
      const ar = tip.ar?.trim();
      if (!en || !fr || !ar) {
        throw new Error(`Tip in "${category}" is missing a language: ${JSON.stringify(tip)}`);
      }
      if (seen.has(en)) {
        skipped += 1;
        continue;
      }
      seen.add(en);
      fresh.push({ en, fr, ar });
    }

    if (fresh.length > 0 && !dryRun) {
      await prisma.coachTip.createMany({
        data: fresh.map((tip) => ({
          category: category as Category,
          status: "PUBLISHED" as const,
          source: "MANUAL" as const,
          textEn: tip.en,
          textFr: tip.fr,
          textAr: tip.ar
        }))
      });
    }

    inserted += fresh.length;
    console.info(`${category}: ${dryRun ? "would insert" : "inserted"} ${fresh.length}, skipped ${tips.length - fresh.length}`);
  }

  console.info(`Done. ${dryRun ? "Would insert" : "Inserted"} ${inserted} tip(s); skipped ${skipped} already present.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
