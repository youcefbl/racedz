import { requireApprovedOrganizer } from "@/lib/organizer";
import { OrganizerEventForm } from "./event-form";
import { getLocale } from "@/lib/i18n";
import { translateOrganizer } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

export default async function NewOrganizerEventPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const locale = getLocale((await searchParams)?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const { organization } = await requireApprovedOrganizer();

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer")}</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">{t("Create event")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            {t("Organization-created races are submitted for admin review before they appear on the public website.")}
          </p>
        </div>
        <OrganizerEventForm organization={organization} />
      </div>
    </div>
  );
}
