import { requireApprovedOrganizer } from "@/lib/organizer";
import { OrganizerEventForm } from "./event-form";

export const dynamic = "force-dynamic";

export default async function NewOrganizerEventPage() {
  const { organization } = await requireApprovedOrganizer();

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Organizer</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">Create event</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Organization-created races are submitted for admin review before they appear on the public website.
          </p>
        </div>
        <OrganizerEventForm organization={organization} />
      </div>
    </div>
  );
}
