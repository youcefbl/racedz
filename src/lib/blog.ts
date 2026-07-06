import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Locale } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n";

// File-backed blog. Each post is a folder under src/content/blog/<slug>/ holding one
// MDX file per language: en.mdx, fr.mdx, ar.mdx. Trilingual is REQUIRED — a post only
// becomes visible (in any language) once all three files exist and none is marked draft.
// This keeps a half-translated post from leaking to a locale it wasn't written for.
//
// Content is authored in-repo (no DB, no admin editor) and compiled to HTML by the
// route via next-mdx-remote. Covers/inline images live in public/blog/<slug>/.

const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");

export const BLOG_CATEGORIES = ["gear", "training", "racing", "nutrition", "beginner"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

// Frontmatter as authored at the top of each MDX file. `title`/`description` are the
// per-language SEO fields; the rest is shared but repeated per file for simplicity.
export type BlogFrontmatter = {
  title: string;
  description: string;
  category: BlogCategory;
  cover: string;
  coverAlt: string;
  author: string;
  publishedAt: string; // ISO date, e.g. "2026-07-05"
  updatedAt?: string;
  featured?: boolean;
  tags?: string[];
  draft?: boolean;
};

export type BlogPostMeta = BlogFrontmatter & {
  slug: string;
  locale: Locale;
  readingMinutes: number;
};

export type BlogPost = BlogPostMeta & {
  /** Raw MDX body (frontmatter stripped) — compiled by the route, not here. */
  body: string;
};

// Published posts change only on deploy, so parse the whole tree once and memoize.
// Cleared implicitly on each cold start; no runtime invalidation needed.
let cache: Map<string, Record<Locale, BlogPost>> | null = null;

function filePath(slug: string, locale: Locale): string {
  return path.join(BLOG_DIR, slug, `${locale}.mdx`);
}

function estimateReadingMinutes(body: string): number {
  // ~200 wpm; Arabic/French word counts are close enough for a "min read" badge.
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function readLocaleFile(slug: string, locale: Locale): BlogPost | null {
  const file = filePath(slug, locale);
  if (!fs.existsSync(file)) return null;

  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  const fm = data as Partial<BlogFrontmatter>;

  // A file missing required SEO fields is treated as absent so the whole post is
  // withheld rather than rendering a broken page.
  if (!fm.title || !fm.description || !fm.category || !fm.publishedAt) return null;

  return {
    slug,
    locale,
    title: fm.title,
    description: fm.description,
    category: fm.category,
    cover: fm.cover ?? `/blog/${slug}/cover.jpg`,
    coverAlt: fm.coverAlt ?? fm.title,
    author: fm.author ?? "ZidRun",
    publishedAt: fm.publishedAt,
    updatedAt: fm.updatedAt,
    featured: fm.featured ?? false,
    tags: fm.tags ?? [],
    draft: fm.draft ?? false,
    readingMinutes: estimateReadingMinutes(content),
    body: content
  };
}

function loadAll(): Map<string, Record<Locale, BlogPost>> {
  if (cache) return cache;

  const map = new Map<string, Record<Locale, BlogPost>>();
  if (!fs.existsSync(BLOG_DIR)) {
    cache = map;
    return map;
  }

  for (const entry of fs.readdirSync(BLOG_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;

    const localized = {} as Record<Locale, BlogPost>;
    let complete = true;
    for (const locale of LOCALES) {
      const post = readLocaleFile(slug, locale);
      // Trilingual enforcement: any missing/draft language withholds the whole post.
      if (!post || post.draft) {
        complete = false;
        break;
      }
      localized[locale] = post;
    }

    if (complete) map.set(slug, localized);
  }

  cache = map;
  return map;
}

function isPublished(post: BlogPostMeta): boolean {
  // Hide future-dated posts (scheduling by publishedAt).
  return new Date(post.publishedAt).getTime() <= Date.now();
}

function byNewest(a: BlogPostMeta, b: BlogPostMeta): number {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

/** All visible posts for a locale, newest first. */
export function getAllPosts(locale: Locale): BlogPostMeta[] {
  return [...loadAll().values()]
    .map((byLocale) => byLocale[locale])
    .filter(isPublished)
    .sort(byNewest)
    .map(stripBody);
}

/** One post in one locale, or null if it doesn't exist / isn't visible yet. */
export function getPost(slug: string, locale: Locale): BlogPost | null {
  const post = loadAll().get(slug)?.[locale];
  if (!post || !isPublished(post)) return null;
  return post;
}

/** Slugs for generateStaticParams — every complete, published post. */
export function getPostSlugs(): string[] {
  return [...loadAll().entries()]
    .filter(([, byLocale]) => isPublished(byLocale.en))
    .map(([slug]) => slug);
}

/** Up to `limit` other posts, preferring the same category, for "keep reading". */
export function getRelatedPosts(slug: string, locale: Locale, limit = 3): BlogPostMeta[] {
  const current = loadAll().get(slug)?.[locale];
  if (!current) return [];
  const others = getAllPosts(locale).filter((p) => p.slug !== slug);
  const sameCategory = others.filter((p) => p.category === current.category);
  const rest = others.filter((p) => p.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

function stripBody(post: BlogPost): BlogPostMeta {
  const { body: _body, ...meta } = post;
  return meta;
}
