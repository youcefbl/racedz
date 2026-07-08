import type { Metadata } from "next";
import { SectionPage } from "@/components/layout/section-page";
import { PolicyDoc } from "@/components/legal/policy-doc";
import { getDictionary, getLocale } from "@/lib/i18n";

type TermsPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export const metadata: Metadata = {
  title: "Terms of Service"
};

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const content = getDictionary(locale).pages.terms;

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"}>
      <SectionPage eyebrow="ZidRun" title={content.title}>
        <PolicyDoc content={content} />
      </SectionPage>
    </div>
  );
}
