import { RaceCard } from "@/components/races/race-card";
import { ButtonLink } from "@/components/ui/button";
import { sampleRaces } from "@/lib/races";

export default function OrganizerEventsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-teal">Organizer</p>
          <h1 className="text-3xl font-black text-gray-950">Events</h1>
        </div>
        <ButtonLink href="/organizer/events/new">Create Event</ButtonLink>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {sampleRaces.map((race) => (
          <RaceCard key={race.id} race={race} />
        ))}
      </div>
    </div>
  );
}
