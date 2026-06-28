import { SectionPage } from "@/components/layout/section-page";
import { getDictionary, getLocale } from "@/lib/i18n";

type PrivacyPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const dictionary = getDictionary(locale);
  const content = dictionary.pages.privacy;

  return (
    <SectionPage eyebrow="ZidRun" title={content.title}>
      <div className="prose-measure space-y-8">
        <p className="text-base leading-7 text-gray-700">{content.intro}</p>
        <PolicySection id="data" title={content.dataTitle} text={content.dataText} />
        <PolicySection id="use" title={content.useTitle} text={content.useText} />
        <PolicySection id="security" title={content.securityTitle} text={content.securityText} />
        <PolicySection id="rights" title={content.rightsTitle} text={content.rightsText} />
      </div>
    </SectionPage>
  );
}

function PolicySection({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <section className="scroll-mt-24">
      <h2 id={id} className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-gray-700">{text}</p>
    </section>
  );
}
