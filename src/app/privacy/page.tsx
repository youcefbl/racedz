import type { Metadata } from "next";
import { SectionPage } from "@/components/layout/section-page";
import { PolicyDoc } from "@/components/legal/policy-doc";
import { getDictionary, getLocale } from "@/lib/i18n";

type PrivacyPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export const metadata: Metadata = {
  title: "Privacy Policy"
};

export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const content = getDictionary(locale).pages.privacy;

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"}>
      <SectionPage eyebrow="ZidRun" title={content.title}>
        <PolicyDoc content={content} />
      </SectionPage>
    </div>
  );
}
