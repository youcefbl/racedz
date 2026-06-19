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
    <SectionPage eyebrow="RaceDZ" title={content.title}>
      <div className="space-y-6">
        <p>{content.intro}</p>
        <PolicySection title={content.dataTitle} text={content.dataText} />
        <PolicySection title={content.useTitle} text={content.useText} />
        <PolicySection title={content.securityTitle} text={content.securityText} />
        <PolicySection title={content.rightsTitle} text={content.rightsText} />
      </div>
    </SectionPage>
  );
}

function PolicySection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-base font-bold text-gray-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
    </div>
  );
}
