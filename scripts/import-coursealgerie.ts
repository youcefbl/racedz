/**
 * Import real races from the coursealgerie_export/races.csv scrape into RaceEvent.
 *
 * Usage:
 *   tsx scripts/import-coursealgerie.ts                 # import as PUBLISHED
 *   IMPORT_STATUS=DRAFT tsx scripts/import-coursealgerie.ts
 *   DRY_RUN=1 tsx scripts/import-coursealgerie.ts       # parse + report, write nothing
 *
 * Idempotent: upserts by slug, so it's safe to re-run.
 * Images: copies the local export image into public/uploads/race/coursealgerie/<file>
 * (the uploads volume served by Caddy); falls back to the remote image_urls if the
 * local file isn't present.
 */
import { PrismaClient, type RaceType, type RaceStatus } from "@prisma/client";
import { copyFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const EXPORT_DIR = path.join(process.cwd(), "coursealgerie_export");
const CSV_PATH = path.join(EXPORT_DIR, "races.csv");
const UPLOAD_SUBDIR = path.join("race", "coursealgerie");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", UPLOAD_SUBDIR);

const STATUS = (process.env.IMPORT_STATUS ?? "PUBLISHED") as RaceStatus;
const DRY_RUN = process.env.DRY_RUN === "1";

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12
};

/** Minimal RFC-4180 CSV parser: handles quoted fields, embedded commas/newlines, "" escapes. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); field = ""; row = []; }
    else if (c === "\r") { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h.trim(), (r[idx] ?? "").trim()])));
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function parseFrenchDate(raw: string): Date | null {
  const m = stripAccents(raw.toLowerCase()).match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = FRENCH_MONTHS[m[2]];
  const year = Number(m[3]);
  if (!month || day < 1 || day > 31) return null;
  // noon UTC to avoid timezone date-shift
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function mapRaceType(title: string, raceTypeRaw: string): RaceType {
  // Title is the reliable headline signal. The scraped race_type field is a dump of
  // every distance/category offered, so it's only a fallback.
  const t = stripAccents(title.toLowerCase());
  const norm = t.replace(/(\d)\s*km?\b/g, "$1km"); // "10 km" / "10k" -> "10km"
  if (t.includes("ultra")) return "ULTRA_TRAIL";
  if (t.includes("trail")) return "TRAIL";
  if (t.includes("semi") || t.includes("half") || norm.includes("21km")) return "HALF_MARATHON";
  if (t.includes("marathon")) return "MARATHON";
  if (norm.includes("10km")) return "TEN_K";
  if (["3km", "5km", "7km"].some((d) => norm.includes(d))) return "FIVE_K";
  if (t.includes("cross")) return "OTHER";

  const f = stripAccents(raceTypeRaw.toLowerCase());
  const tokens = f.split(",").map((x) => x.trim());
  if (f.includes("ultra")) return "ULTRA_TRAIL";
  if (f.includes("trail")) return "TRAIL";
  if (tokens.some((x) => x.includes("semi") || x.includes("21 km"))) return "HALF_MARATHON";
  if (tokens.some((x) => x === "marathon")) return "MARATHON";
  if (tokens.some((x) => x.includes("10 km"))) return "TEN_K";
  if (tokens.some((x) => x.includes("5 km"))) return "FIVE_K";
  if (f.includes("route")) return "ROAD";
  return "OTHER";
}

function slugFromUrl(url: string, title: string): string {
  const last = url.split("/").filter(Boolean).pop() ?? "";
  const base = last || stripAccents(title.toLowerCase()).replace(/[^a-z0-9]+/g, "-");
  return base.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function resolveImage(localPath: string, remoteUrls: string, slug: string): Promise<string | null> {
  // Prefer the local exported file -> copy into the uploads volume.
  if (localPath) {
    const abs = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
    if (existsSync(abs)) {
      const ext = path.extname(abs) || ".jpg";
      const dest = path.join(UPLOAD_DIR, `${slug}${ext}`);
      if (!DRY_RUN) {
        await mkdir(UPLOAD_DIR, { recursive: true });
        await copyFile(abs, dest);
      }
      return `/uploads/${UPLOAD_SUBDIR.split(path.sep).join("/")}/${slug}${ext}`;
    }
  }
  // Fallback: first remote URL (CSP allows https: images; optimizer is disabled).
  const remote = remoteUrls.split(/[ ,]+/).find((u) => u.startsWith("http"));
  return remote ?? null;
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}. Make sure coursealgerie_export/ is present.`);
    process.exit(1);
  }
  const rows = parseCsv(await readFile(CSV_PATH, "utf8"));
  console.info(`Parsed ${rows.length} rows. status=${STATUS} dry_run=${DRY_RUN}\n`);

  const usedSlugs = new Set<string>();
  let created = 0;
  let updated = 0;
  const skipped: string[] = [];

  for (const r of rows) {
    const title = r.title?.trim();
    if (!title) { skipped.push(`(no title) ${r.source_url}`); continue; }

    const startDate = parseFrenchDate(r.date_text ?? "");
    if (!startDate) { skipped.push(`bad date "${r.date_text}" — ${title}`); continue; }

    let slug = slugFromUrl(r.source_url ?? "", title);
    while (usedSlugs.has(slug)) slug = `${slug}-2`;
    usedSlugs.add(slug);

    const mainImageUrl = await resolveImage(r.local_image_paths ?? "", r.image_urls ?? "", slug);

    let description = r.description?.trim() || title;
    const price = r.price?.trim();
    if (price && !/^(da|gratuit)$/i.test(price)) description += `\n\nTarif (à confirmer) : ${price}`;

    const data = {
      source: "PLATFORM" as const,
      title,
      description,
      raceType: mapRaceType(title, r.race_type ?? ""),
      status: STATUS,
      startDate,
      wilaya: r.wilaya?.trim() || r.city?.trim() || "Algérie",
      city: r.city?.trim() || r.wilaya?.trim() || "—",
      mainImageUrl,
      organizerName: r.organizer_name?.trim() || null,
      contactEmail: r.organizer_email?.trim() || null,
      contactPhone: r.organizer_phone?.trim() || null,
      organizerUrl: r.registration_url?.trim() || null
    };

    if (DRY_RUN) {
      console.info(`would import: ${slug} [${data.raceType}] ${startDate.toISOString().slice(0, 10)} ${data.city}/${data.wilaya}${mainImageUrl ? "" : " (no image)"}`);
      created++;
      continue;
    }

    const existing = await prisma.raceEvent.findUnique({ where: { slug } });
    await prisma.raceEvent.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    existing ? updated++ : created++;
  }

  console.info(`\nDone. created=${created} updated=${updated} skipped=${skipped.length}`);
  if (skipped.length) {
    console.info(`\nSkipped (need manual entry):`);
    for (const s of skipped) console.info(`  - ${s}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
