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
    <SectionPage eyebrow="ZidRun" title={content.title}>
      <div className="prose-measure space-y-8">
        <p className="text-base leading-7 text-gray-700">{content.intro}</p>
        <PolicySection id="account" title={content.accountTitle} text={content.accountText} />
        <PolicySection id="registration" title={content.registrationTitle} text={content.registrationText} />
        <PolicySection id="organizer" title={content.organizerTitle} text={content.organizerText} />
        <PolicySection id="content" title={content.contentTitle} text={content.contentText} />
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
