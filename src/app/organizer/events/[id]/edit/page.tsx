import { SectionPage } from "@/components/layout/section-page";

type EditOrganizerEventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditOrganizerEventPage({ params }: EditOrganizerEventPageProps) {
  const { id } = await params;

  return (
    <SectionPage eyebrow="Organizer" title={`Edit ${id}`}>
      Update event details, route information, race rules, and registration settings.
    </SectionPage>
  );
}
