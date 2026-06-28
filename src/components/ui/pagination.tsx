import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";

export type PaginationProps = {
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
  locale?: Locale;
};

export function Pagination({ basePath, searchParams = {}, page, totalPages, locale = "en" }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const t = getDictionary(locale).ui;
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  const makeHref = (targetPage: number) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null || key === "page") {
        continue;
      }

      if (Array.isArray(value)) {
        for (const v of value) {
          params.append(key, v);
        }
      } else {
        params.set(key, value);
      }
    }

    if (targetPage !== 1) {
      params.set("page", String(targetPage));
    }

    const query = params.toString();
    return withLocale(`${basePath}${query ? `?${query}` : ""}`, locale);
  };

  return (
    <nav aria-label={t.page} className="mt-4 flex flex-col items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:flex-row">
      <p className="text-sm text-gray-600">
        {t.page} <span className="font-semibold text-gray-950">{page}</span> {t.pageOf}{" "}
        <span className="font-semibold text-gray-950">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <PageButton href={makeHref(1)} disabled={!canGoBack} ariaLabel={t.firstPage}>
          <ChevronsLeft className="size-4" aria-hidden="true" />
        </PageButton>
        <PageButton href={makeHref(page - 1)} disabled={!canGoBack} ariaLabel={t.previousPage}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t.previous}</span>
        </PageButton>
        <PageButton href={makeHref(page + 1)} disabled={!canGoForward} ariaLabel={t.nextPage}>
          <span className="hidden sm:inline">{t.next}</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </PageButton>
        <PageButton href={makeHref(totalPages)} disabled={!canGoForward} ariaLabel={t.lastPage}>
          <ChevronsRight className="size-4" aria-hidden="true" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  href,
  disabled,
  ariaLabel,
  children
}: {
  href: string;
  disabled: boolean;
  ariaLabel: string;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={ariaLabel}
        className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-400"
      >
        {children}
      </span>
    );
  }

  return (
    <ButtonLink href={href} variant="outline" size="sm" aria-label={ariaLabel}>
      {children}
    </ButtonLink>
  );
}
