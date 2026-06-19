import { SectionPage } from "@/components/layout/section-page";
import { getDictionary, getLocale } from "@/lib/i18n";

type TermsPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const dictionary = getDictionary(locale);
  const content = dictionary.pages.terms;

  return (
    <SectionPage eyebrow="RaceDZ" title={content.title}>
      <div className="space-y-6">
        <p>{content.intro}</p>
        <PolicySection title={content.accountTitle} text={content.accountText} />
        <PolicySection title={content.registrationTitle} text={content.registrationText} />
        <PolicySection title={content.organizerTitle} text={content.organizerText} />
        <PolicySection title={content.contentTitle} text={content.contentText} />
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
