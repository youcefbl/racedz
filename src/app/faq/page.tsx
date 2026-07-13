import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { SectionPage } from "@/components/layout/section-page";
import { getLocale } from "@/lib/i18n";
import { getContentDictionary } from "@/lib/i18n-content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ZidRun races, accounts, payments, and the AI coach."
};

type FaqPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export default async function FaqPage({ searchParams }: FaqPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const content = getContentDictionary(locale).faq;

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"}>
      <SectionPage eyebrow="ZidRun" title={content.title}>
        <div className="space-y-5">
          <p className="max-w-2xl text-base leading-7 text-gray-700">{content.intro}</p>
          <div className="divide-y divide-gray-200 border-t border-gray-200">
            {content.items.map((item) => (
              <details key={item.q} className="group py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-start font-bold text-gray-950 [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown
                    className="size-5 shrink-0 text-gray-400 transition group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="max-w-2xl pb-3 text-sm leading-7 text-gray-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </SectionPage>
    </div>
  );
}
