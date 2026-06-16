import { notFound } from "next/navigation";
import { Mail, Phone, Route, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getOrganizerRaceById, getOrganizerRaceRegistrations, requireApprovedOrganizer } from "@/lib/organizer";

export const dynamic = "force-dynamic";

type EventRegistrationsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventRegistrationsPage({ params }: EventRegistrationsPageProps) {
  const { id } = await params;
  const { organization } = await requireApprovedOrganizer();
  const [race, registrations] = await Promise.all([
    getOrganizerRaceById(organization.id, id),
    getOrganizerRaceRegistrations(organization.id, id)
  ]);

  if (!race) {
    notFound();
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Organizer</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{race.title} registrations</h1>
          </div>
          <ButtonLink href={`/api/organizer/events/${race.id}/registrations/export`} variant="outline">
            Export CSV
          </ButtonLink>
        </div>

        {registrations.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-gray-950">No participants yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              Registrations will appear here after runners sign up for this race.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-normal text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Runner</th>
                    <th className="px-4 py-3">Distance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {registrations.map((registration) => (
                    <tr key={registration.id}>
                      <td className="px-4 py-4">
                        <div className="flex gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                            <UserRound className="size-5" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-950">
                              {registration.user.firstName} {registration.user.lastName}
                            </p>
                            <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <Mail className="size-3.5" aria-hidden="true" />
                              {registration.user.email}
                            </p>
                            {registration.user.phone ? (
                              <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                <Phone className="size-3.5" aria-hidden="true" />
                                {registration.user.phone}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        <p className="flex items-center gap-2">
                          <Route className="size-4 text-brand-teal" aria-hidden="true" />
                          {registration.raceCategory.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {registration.raceCategory.distanceKm}K · {formatDzd(registration.raceCategory.priceDzd ?? undefined)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="orange">{formatEnumLabel(registration.status)}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="blue">{formatEnumLabel(registration.paymentStatus)}</Badge>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{formatDateTime(registration.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
