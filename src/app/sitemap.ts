import type { MetadataRoute } from "next";
import { getPostSlugs } from "@/lib/blog";
import { getPrisma } from "@/lib/db";

const SITE_URL = "https://zidrun.com";

// Refresh hourly so newly published races/posts appear without a redeploy.
export const revalidate = 3600;

function withAlternates(path: string) {
  return {
    fr: `${SITE_URL}${path}${path.includes("?") ? "&" : "?"}lang=fr`,
    ar: `${SITE_URL}${path}${path.includes("?") ? "&" : "?"}lang=ar`
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/races", priority: 0.9, changeFrequency: "daily" },
    { path: "/blog", priority: 0.9, changeFrequency: "daily" },
    { path: "/coach", priority: 0.8, changeFrequency: "monthly" },
    { path: "/runners", priority: 0.7, changeFrequency: "monthly" },
    { path: "/organizers", priority: 0.7, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "yearly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" }
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
    alternates: { languages: withAlternates(path) }
  }));

  for (const slug of getPostSlugs()) {
    entries.push({
      url: `${SITE_URL}/blog/${slug}`,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: withAlternates(`/blog/${slug}`) }
    });
  }

  // Published race pages. The DB may be unreachable during `next build`; skip races
  // rather than fail the whole sitemap.
  try {
    const races = await getPrisma().raceEvent.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true }
    });
    for (const race of races) {
      entries.push({
        url: `${SITE_URL}/races/${race.slug}`,
        lastModified: race.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6
      });
    }
  } catch {
    // No DB at build time — static routes + blog posts still ship.
  }

  return entries;
}
