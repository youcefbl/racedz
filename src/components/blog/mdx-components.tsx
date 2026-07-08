import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ExternalLink, Info, Lightbulb, MapPin, Star, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

// MDX element + custom-component map for blog articles. Everything is styled with the
// site's CSS theme variables (var(--text) etc.) so posts render correctly in the light,
// dark, and race themes without a `prose` plugin. All server components — no client JS —
// which keeps articles fast and fully crawlable.

function slugify(children: ReactNode): string | undefined {
  if (typeof children !== "string") return undefined;
  return children
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function H2({ children, ...props }: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      id={slugify(children)}
      className="mt-12 scroll-mt-24 text-2xl font-semibold tracking-tight text-[var(--text-strong)]"
      {...props}
    >
      {children}
    </h2>
  );
}

function H3({ children, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      id={slugify(children)}
      className="mt-8 scroll-mt-24 text-xl font-semibold tracking-tight text-[var(--text-strong)]"
      {...props}
    >
      {children}
    </h3>
  );
}

function Paragraph(props: ComponentPropsWithoutRef<"p">) {
  return <p className="mt-5 text-[1.0625rem] leading-8 text-[var(--text)]" {...props} />;
}

function Anchor({ href = "#", children, ...props }: ComponentPropsWithoutRef<"a">) {
  const external = /^https?:\/\//.test(href);
  const className = "font-semibold text-brand-teal underline decoration-brand-teal/30 underline-offset-2 transition hover:decoration-brand-teal";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function UnorderedList(props: ComponentPropsWithoutRef<"ul">) {
  return <ul className="mt-5 space-y-2 ps-6 text-[1.0625rem] leading-8 text-[var(--text)] [&>li]:list-disc [&>li]:marker:text-brand-orange" {...props} />;
}

function OrderedList(props: ComponentPropsWithoutRef<"ol">) {
  return <ol className="mt-5 space-y-2 ps-6 text-[1.0625rem] leading-8 text-[var(--text)] [&>li]:list-decimal [&>li]:marker:font-semibold [&>li]:marker:text-brand-teal" {...props} />;
}

function Blockquote(props: ComponentPropsWithoutRef<"blockquote">) {
  return (
    <blockquote
      className="mt-6 border-s-2 border-brand-teal/40 bg-[var(--surface-soft)] px-5 py-3 text-[1.0625rem] italic leading-8 text-[var(--text)]"
      {...props}
    />
  );
}

function Table(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full border-collapse text-start text-sm" {...props} />
    </div>
  );
}

function Th(props: ComponentPropsWithoutRef<"th">) {
  return <th className="border-b border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-start font-semibold text-[var(--text-strong)]" {...props} />;
}

function Td(props: ComponentPropsWithoutRef<"td">) {
  return <td className="border-b border-[var(--border)] px-4 py-3 align-top text-[var(--text)]" {...props} />;
}

function InlineCode(props: ComponentPropsWithoutRef<"code">) {
  return <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[0.9em] text-[var(--text-strong)]" {...props} />;
}

function Hr() {
  return <hr className="my-10 border-[var(--border)]" />;
}

function BlogImage({ src = "", alt = "", ...props }: ComponentPropsWithoutRef<"img">) {
  return (
    <figure className="mt-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl border border-[var(--border)]" {...props} />
      {alt ? <figcaption className="mt-2 text-center text-sm text-[var(--text-muted)]">{alt}</figcaption> : null}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Custom components authors can use inside MDX bodies.
// ---------------------------------------------------------------------------

type CalloutType = "tip" | "warning" | "info";

const CALLOUT_STYLES: Record<CalloutType, { icon: typeof Info; ring: string; iconColor: string }> = {
  tip: { icon: Lightbulb, ring: "border-brand-teal/40 bg-[var(--primary-soft)]", iconColor: "text-brand-teal" },
  warning: { icon: AlertTriangle, ring: "border-brand-orange/40 bg-[var(--accent-soft)]", iconColor: "text-brand-orange" },
  info: { icon: Info, ring: "border-[var(--border-strong)] bg-[var(--surface-soft)]", iconColor: "text-[var(--text-muted)]" }
};

export function Callout({ type = "tip", title, children }: { type?: CalloutType; title?: string; children: ReactNode }) {
  const style = CALLOUT_STYLES[type];
  const Icon = style.icon;
  return (
    <div className={cn("mt-6 flex gap-3 rounded-xl border p-4", style.ring)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", style.iconColor)} aria-hidden="true" />
      <div className="text-[1rem] leading-7 text-[var(--text)]">
        {title ? <p className="font-semibold text-[var(--text-strong)]">{title}</p> : null}
        <div className={cn(title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}

// A gear pick card — the workhorse for "best X" roundups. price/where are free text so
// authors can localize (e.g. "12 000–16 000 DZD", "متوفر في...").
export function ProductPick({
  name,
  badge,
  price,
  where,
  rating,
  url,
  urlLabel = "View",
  children
}: {
  name: string;
  badge?: string;
  price?: string;
  where?: string;
  rating?: number;
  url?: string;
  urlLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-[var(--text-strong)]">{name}</h3>
          {typeof rating === "number" ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-orange">
              <Star className="size-4 fill-current" aria-hidden="true" />
              {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
        {badge ? (
          <span className="rounded-full bg-brand-teal px-3 py-1 text-xs font-semibold text-white">{badge}</span>
        ) : null}
      </div>

      {children ? <div className="mt-2 text-[1rem] leading-7 text-[var(--text)]">{children}</div> : null}

      {(price || where || url) ? (
        <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--border)] pt-3 text-sm">
          {price ? (
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-brand-teal" aria-hidden="true" />
              <dt className="sr-only">Price</dt>
              <dd className="font-semibold text-[var(--text-strong)]">{price}</dd>
            </div>
          ) : null}
          {where ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-brand-orange" aria-hidden="true" />
              <dt className="sr-only">Where to buy</dt>
              <dd className="text-[var(--text)]">{where}</dd>
            </div>
          ) : null}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 font-semibold text-brand-teal underline-offset-2 hover:underline ms-auto"
            >
              {urlLabel}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

// End-of-article call to action linking back into the product (races / signup).
export function Cta({ href, label, sublabel }: { href: string; label: string; sublabel?: string }) {
  return (
    <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl border border-brand-teal/30 bg-[var(--primary-soft)] p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-lg font-semibold text-[var(--text-strong)]">{label}</p>
        {sublabel ? <p className="mt-1 text-sm text-[var(--text)]">{sublabel}</p> : null}
      </div>
      <Link
        href={href}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand-teal px-5 text-sm font-semibold text-white transition hover:bg-brand-tealDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        {label}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </div>
  );
}

// Passed to next-mdx-remote so every article gets consistent styling + the custom
// components without per-post imports.
export const mdxComponents = {
  h2: H2,
  h3: H3,
  p: Paragraph,
  a: Anchor,
  ul: UnorderedList,
  ol: OrderedList,
  blockquote: Blockquote,
  table: Table,
  th: Th,
  td: Td,
  code: InlineCode,
  hr: Hr,
  img: BlogImage,
  Callout,
  ProductPick,
  Cta
};
