import { Mail, Phone } from "lucide-react";
import { SectionPage } from "@/components/layout/section-page";
import { getDictionary, getLocale } from "@/lib/i18n";

type ContactPageProps = {
  searchParams?: Promise<{ lang?: string }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const dictionary = getDictionary(locale);
  const content = dictionary.pages.contact;

  return (
    <SectionPage eyebrow="ZidRun" title={content.title}>
      <div className="space-y-8">
        <p className="max-w-2xl text-base leading-7 text-gray-700">{content.intro}</p>
        <dl className="divide-y divide-gray-200 border-t border-gray-200">
          <ContactRow
            icon={Mail}
            label={content.emailLabel}
            value={content.email}
            href={`mailto:${content.email}`}
          />
          <ContactRow icon={Phone} label={content.phoneLabel} value={content.phone} href={`tel:${content.phone}`} />
        </dl>
      </div>
    </SectionPage>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  const valueNode = href ? (
    <a
      href={href}
      className="inline-flex min-h-[44px] items-center font-semibold text-brand-teal transition hover:text-brand-tealDark hover:underline"
    >
      {value}
    </a>
  ) : (
    <span className="inline-flex min-h-[44px] items-center font-semibold text-gray-950">{value}</span>
  );

  return (
    <div className="flex items-start gap-3 py-4">
      <Icon className="mt-3 size-5 shrink-0 text-brand-orange" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-normal text-gray-500">{label}</p>
        <p className="text-sm">{valueNode}</p>
      </div>
    </div>
  );
}
