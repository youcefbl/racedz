import { notFound } from "next/navigation";
import { getOrganizationProfile, requireApprovedOrganizer } from "@/lib/organizer";
import { OrganizationSettingsForm } from "./organization-settings-form";
import { getLocale } from "@/lib/i18n";
import { translateOrganizer } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

export default async function OrganizerSettingsPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const locale = getLocale((await searchParams)?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const { organization, membership } = await requireApprovedOrganizer();
  const profile = await getOrganizationProfile(organization.id);

  if (!profile) {
    notFound();
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer settings")}</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">{t("Organization profile")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            {t("Keep public organization details and logo ready for race pages and admin review.")}
          </p>
        </div>
        <OrganizationSettingsForm organization={profile} canEdit={membership.role === "OWNER" || membership.role === "ADMIN"} />
      </div>
    </div>
  );
}
