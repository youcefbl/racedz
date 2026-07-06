import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { formatBlogDate, PostCard } from "@/components/blog/post-card";
import { mdxComponents } from "@/components/blog/mdx-components";
import { getPost, getPostSlugs, getRelatedPosts } from "@/lib/blog";
import { getDictionary, getLocale, withLocale, LOCALES, type Locale } from "@/lib/i18n";

const SITE_URL = "https://zidrun.com";

type ArticleProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: Locale }>;
};

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params, searchParams }: ArticleProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = getLocale((await searchParams)?.lang);
  const post = getPost(slug, locale);
  if (!post) return { title: "Article not found" };

  const path = `/blog/${slug}`;
  const canonical = locale === "en" ? path : `${path}?lang=${locale}`;

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical,
      languages: Object.fromEntries(LOCALES.map((l) => [l, l === "en" ? path : `${path}?lang=${l}`]))
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: canonical,
      images: [{ url: post.cover, alt: post.coverAlt }],
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      section: post.category,
      tags: post.tags
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.cover]
    }
  };
}

export default async function BlogArticlePage({ params, searchParams }: ArticleProps) {
  const { slug } = await params;
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).pages.blog;
  const rtl = locale === "ar";

  const post = getPost(slug, locale);
  if (!post) notFound();

  const { content } = await compileMDX({
    source: post.body,
    components: mdxComponents,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } }
  });

  const related = getRelatedPosts(slug, locale);
  const minRead = t.minRead.replace("{n}", String(post.readingMinutes));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: `${SITE_URL}${post.cover}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: locale,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "ZidRun",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` }
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` }
  };

  return (
    <div className="bg-[var(--surface-soft)]" dir={rtl ? "rtl" : "ltr"}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={withLocale("/blog", locale)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-teal transition hover:opacity-80"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t.backToBlog}
        </Link>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-brand-teal">
              {t.categories[post.category] ?? post.category}
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
              <Clock className="size-4" aria-hidden="true" />
              {minRead}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-[var(--text-strong)] sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[var(--text)]">{post.description}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">
              {t.by} {post.author}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              {formatBlogDate(post.publishedAt, locale)}
            </span>
          </div>
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.cover}
          alt={post.coverAlt}
          className="mt-8 aspect-[16/9] w-full rounded-2xl border border-[var(--border)] object-cover"
        />

        <div className="mt-2">{content}</div>
      </article>

      {related.length > 0 ? (
        <section className="border-t border-[var(--border)] bg-[var(--surface)]" dir={rtl ? "rtl" : "ltr"}>
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">{t.relatedTitle}</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <PostCard key={item.slug} post={item} locale={locale} labels={t} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
