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
    <SectionPage eyebrow="RaceDZ" title={content.title}>
      <div className="space-y-6">
        <p>{content.intro}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoBlock title={content.runnersTitle} text={content.runnersText} />
          <InfoBlock title={content.organizersTitle} text={content.organizersText} />
          <InfoBlock title={content.adminsTitle} text={content.adminsText} />
        </div>
      </div>
    </SectionPage>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="font-bold text-gray-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
    </div>
  );
}
