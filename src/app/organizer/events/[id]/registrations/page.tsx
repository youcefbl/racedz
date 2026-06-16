import { SectionPage } from "@/components/layout/section-page";

type EventRegistrationsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventRegistrationsPage({ params }: EventRegistrationsPageProps) {
  const { id } = await params;

  return (
    <SectionPage eyebrow="Organizer" title={`Registrations for ${id}`}>
      No participant rows to display yet.
    </SectionPage>
  );
}
