import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getOrganizerRaceById, requireApprovedOrganizer } from "@/lib/organizer";
import { CategoryForm } from "./category-form";
import { EventEditForm } from "./event-edit-form";
import { getLocale } from "@/lib/i18n";
import { translateOrganizer, translateOrganizerEnum } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

type EditOrganizerEventPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function EditOrganizerEventPage({ params, searchParams }: EditOrganizerEventPageProps) {
  const locale = getLocale((await searchParams)?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const { id } = await params;
  const { organization } = await requireApprovedOrganizer();
  const race = await getOrganizerRaceById(organization.id, id);

  if (!race) {
    notFound();
  }

  const editable = race.status === "DRAFT" || race.status === "PENDING_REVIEW" || race.status === "REJECTED";

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer")}</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{t("Edit event")}: {race.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={editable ? "orange" : "green"}>{translateOrganizerEnum(locale, race.status)}</Badge>
              <Badge variant="blue">{translateOrganizerEnum(locale, race.registrationStatus)}</Badge>
            </div>
          </div>
        </div>

        {editable ? (
          <div className="grid gap-6">
            <EventEditForm race={race} />

            <section className="grid gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-950">{t("Categories")}</h2>
                <p className="mt-1 text-sm text-gray-500">{t("Edit distances and prices before the race is published.")}</p>
              </div>
              {race.categories.map((category) => (
                <CategoryForm key={category.id} raceId={race.id} category={category} />
              ))}
              <CategoryForm raceId={race.id} />
            </section>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-gray-950">{t("Editing locked")}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {t("Published, cancelled, completed, and live-registration races are locked for organizer editing. Ask an admin to unpublish the race before changing event details.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
