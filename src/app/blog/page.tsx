import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PostCard } from "@/components/blog/post-card";
import { getAllPosts } from "@/lib/blog";
import { getDictionary, getLocale, type Locale } from "@/lib/i18n";

type BlogIndexProps = {
  searchParams?: Promise<{ lang?: Locale }>;
};

export async function generateMetadata({ searchParams }: BlogIndexProps): Promise<Metadata> {
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).pages.blog;
  const canonical = locale === "en" ? "/blog" : `/blog?lang=${locale}`;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: {
      canonical,
      languages: { en: "/blog", fr: "/blog?lang=fr", ar: "/blog?lang=ar" }
    },
    openGraph: {
      type: "website",
      title: t.metaTitle,
      description: t.metaDescription,
      url: canonical
    }
  };
}

export default async function BlogIndexPage({ searchParams }: BlogIndexProps) {
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).pages.blog;
  const rtl = locale === "ar";
  const posts = getAllPosts(locale);

  const featured = posts.find((p) => p.featured) ?? posts[0] ?? null;
  const rest = posts.filter((p) => p.slug !== featured?.slug);

  return (
    <div className="bg-[var(--surface-soft)]" dir={rtl ? "rtl" : "ltr"}>
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-brand-teal">
            <BookOpen className="size-4" aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[var(--text)]">{t.subtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {posts.length === 0 ? (
          <p className="py-16 text-center text-[var(--text-muted)]">{t.empty}</p>
        ) : (
          <div className="space-y-10">
            {featured ? (
              <div>
                <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-orange">{t.featured}</p>
                <PostCard post={featured} locale={locale} labels={t} featured />
              </div>
            ) : null}

            {rest.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <PostCard key={post.slug} post={post} locale={locale} labels={t} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
