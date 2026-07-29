import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { BlogPostMeta } from "@/lib/blog";
import { withLocale, type Locale } from "@/lib/i18n";

type BlogLabels = {
  readMore: string;
  minRead: string;
  categories: Record<string, string>;
};

const DATE_LOCALES: Record<Locale, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-DZ" };

export function formatBlogDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], { dateStyle: "long" }).format(new Date(iso));
}

export function formatBlogReadingTime(minutes: number, locale: Locale, template: string): string {
  if (locale !== "ar") return template.replace("{n}", String(minutes));
  if (minutes === 1) return "دقيقة قراءة";
  if (minutes === 2) return "دقيقتان للقراءة";
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق قراءة`;
  return `${minutes} دقيقة قراءة`;
}

export function PostCard({
  post,
  locale,
  labels,
  featured = false
}: {
  post: BlogPostMeta;
  locale: Locale;
  labels: BlogLabels;
  featured?: boolean;
}) {
  const href = withLocale(`/blog/${post.slug}`, locale);
  const minRead = formatBlogReadingTime(post.readingMinutes, locale, labels.minRead);

  return (
    <Link
      href={href}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-soft transition hover:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${
        featured ? "md:flex-row" : ""
      }`}
    >
      <div className={`relative overflow-hidden bg-[var(--surface-soft)] ${featured ? "md:w-1/2" : ""}`}>
        <Image
          src={post.cover}
          alt={post.coverAlt}
          width={1200}
          height={675}
          priority={featured}
          sizes={featured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
          className={`aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
            featured ? "md:h-full" : ""
          }`}
        />
      </div>

      <div className={`flex flex-1 flex-col p-5 ${featured ? "md:justify-center md:p-8" : ""}`}>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-brand-teal">
            {labels.categories[post.category] ?? post.category}
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
            <Clock className="size-3.5" aria-hidden="true" />
            {minRead}
          </span>
        </div>

        <h3
          className={`mt-3 font-semibold tracking-tight text-[var(--text-strong)] transition group-hover:text-brand-teal ${
            featured ? "text-2xl" : "text-lg"
          }`}
        >
          {post.title}
        </h3>
        <p className={`mt-2 text-[var(--text)] ${featured ? "line-clamp-3 text-base" : "line-clamp-2 text-sm"}`}>
          {post.description}
        </p>

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-teal">
          {labels.readMore}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
