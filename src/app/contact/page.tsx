import { Mail, Phone, Clock } from "lucide-react";
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
    <SectionPage eyebrow="RaceDZ" title={content.title}>
      <div className="space-y-6">
        <p>{content.intro}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ContactCard
            icon={Mail}
            label={content.emailLabel}
            value={content.email}
            href={`mailto:${content.email}`}
          />
          <ContactCard icon={Phone} label={content.phoneLabel} value={content.phone} href={`tel:${content.phone}`} />
          <ContactCard icon={Clock} label={content.hoursLabel} value={content.hours} />
        </div>
      </div>
    </SectionPage>
  );
}

function ContactCard({
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
    <a href={href} className="text-brand-teal transition hover:text-brand-tealDark hover:underline">
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Icon className="mt-0.5 size-5 text-brand-orange" aria-hidden="true" />
      <div>
        <p className="text-xs font-bold uppercase tracking-normal text-gray-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-gray-950">{valueNode}</p>
      </div>
    </div>
  );
}
