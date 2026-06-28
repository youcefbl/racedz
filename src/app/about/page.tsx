import { SectionPage } from "@/components/layout/section-page";
import { getDictionary, getLocale } from "@/lib/i18n";

type AboutPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const dictionary = getDictionary(locale);
  const content = dictionary.pages.about;

  return (
    <SectionPage eyebrow="ZidRun" title={content.title}>
      <div className="space-y-8">
        <p className="max-w-2xl text-base leading-7 text-gray-700">{content.intro}</p>
        <dl className="divide-y divide-gray-200 border-t border-gray-200">
          <InfoRow title={content.runnersTitle} text={content.runnersText} />
          <InfoRow title={content.organizersTitle} text={content.organizersText} />
          <InfoRow title={content.adminsTitle} text={content.adminsText} />
        </dl>
      </div>
    </SectionPage>
  );
}

function InfoRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-1.5 py-5 sm:grid-cols-[12rem_1fr] sm:gap-6">
      <dt className="font-bold text-gray-950">{title}</dt>
      <dd className="max-w-2xl text-sm leading-7 text-gray-700">{text}</dd>
    </div>
  );
}
