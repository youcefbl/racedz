import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const contentRoot = join(root, "src/content/blog");
const locales = ["en", "fr", "ar"] as const;
const errors: string[] = [];

for (const slug of readdirSync(contentRoot).filter((entry) => !entry.startsWith("."))) {
  const localeMetadata: Array<{ locale: string; publishedAt: string; updatedAt: string }> = [];

  for (const locale of locales) {
    const relativePath = `src/content/blog/${slug}/${locale}.mdx`;
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`${relativePath}: missing translation`);
      continue;
    }

    const source = readFileSync(absolutePath, "utf8");
    const { data, content } = matter(source);

    if (/TODO:|verify before publishing/i.test(source)) errors.push(`${relativePath}: contains a publication TODO`);
    if (/\brating=|\bprice=/.test(content)) errors.push(`${relativePath}: contains an unverified rating or price`);
    if (!data.updatedAt) errors.push(`${relativePath}: missing updatedAt`);
    if (data.imageKind !== "ai-illustration") errors.push(`${relativePath}: missing AI-image disclosure metadata`);
    if (!data.coverAlt?.trim()) errors.push(`${relativePath}: missing coverAlt`);

    const imagePaths = [data.cover, ...Array.from(content.matchAll(/\]\((\/blog\/[^)]+)\)/g), (match) => match[1])]
      .filter((value): value is string => typeof value === "string");
    for (const imagePath of imagePaths) {
      const publicPath = join(root, "public", imagePath.replace(/^\//, ""));
      if (!existsSync(publicPath)) errors.push(`${relativePath}: missing image ${imagePath}`);
    }

    localeMetadata.push({ locale, publishedAt: String(data.publishedAt ?? ""), updatedAt: String(data.updatedAt ?? "") });
  }

  const publishedDates = new Set(localeMetadata.map((entry) => entry.publishedAt));
  const updatedDates = new Set(localeMetadata.map((entry) => entry.updatedAt));
  if (publishedDates.size > 1) errors.push(`${slug}: publishedAt differs between translations`);
  if (updatedDates.size > 1) errors.push(`${slug}: updatedAt differs between translations`);
}

if (errors.length > 0) {
  console.error(`Blog content check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

console.log("Blog content check passed.");
