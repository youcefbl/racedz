import { SectionPage } from "@/components/layout/section-page";

type OrganizerEventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizerEventPage({ params }: OrganizerEventPageProps) {
  const { id } = await params;

  return (
    <SectionPage eyebrow="Organizer event" title={id}>
      Event overview, registration status, categories, and participant totals.
    </SectionPage>
  );
}
