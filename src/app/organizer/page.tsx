import { CalendarPlus, Download, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const stats = [
  { label: "Published events", value: "4" },
  { label: "Pending registrations", value: "128" },
  { label: "Manual reviews", value: "17" }
];

export default function OrganizerPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-teal">Organizer dashboard</p>
          <h1 className="text-3xl font-black text-gray-950">Manage your races</h1>
        </div>
        <ButtonLink href="/organizer/events/new" size="lg">
          <CalendarPlus className="size-5" aria-hidden="true" />
          Create Event
        </ButtonLink>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-black text-gray-950">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-gray-950">Next organizer tasks</h2>
          <ButtonLink href="/api/organizer/events/race-alger-10k/registrations/export" variant="outline" size="sm">
            <Download className="size-4" aria-hidden="true" />
            Export
          </ButtonLink>
        </div>
        <div className="grid gap-3 text-sm text-gray-600">
          <p className="flex items-center gap-2">
            <UsersRound className="size-4 text-brand-teal" aria-hidden="true" />
            Review pending participant payments and documents.
          </p>
          <p>Open and close registrations from the event detail once database actions are wired.</p>
        </div>
      </div>
    </div>
  );
}
