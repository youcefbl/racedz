import Link from "next/link";
import { Building2, CalendarDays, MapPin, Route, Trophy, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getAdminRaces, requireAdmin } from "@/lib/admin";
import { approveRaceAction, rejectRaceAction, unpublishRaceAction } from "../actions";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminRacesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    registrationStatus?: string;
    source?: string;
  }>;
};

export default async function AdminRacesPage({ searchParams }: AdminRacesPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const races = await getAdminRaces({
    q: filters?.q,
    status: filters?.status,
    registrationStatus: filters?.registrationStatus,
    source: filters?.source
  });

  return (
    <AdminShell title="Races" description="Search races, review organization-created events, and control public publication.">
      <FilterBar action="/admin/races" searchPlaceholder="Search race, organizer, city, wilaya">
        <SelectFilter
          name="status"
          label="All race statuses"
          defaultValue={filters?.status}
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "PENDING_REVIEW", label: "Pending review" },
            { value: "PUBLISHED", label: "Published" },
            { value: "CANCELLED", label: "Cancelled" },
            { value: "COMPLETED", label: "Completed" },
            { value: "REJECTED", label: "Rejected" }
          ]}
        />
        <SelectFilter
          name="registrationStatus"
          label="All registration states"
          defaultValue={filters?.registrationStatus}
          options={[
            { value: "NOT_OPEN", label: "Not open" },
            { value: "OPEN", label: "Open" },
            { value: "CLOSED", label: "Closed" },
            { value: "FULL", label: "Full" },
            { value: "CANCELLED", label: "Cancelled" }
          ]}
        />
        <SelectFilter
          name="source"
          label="All sources"
          defaultValue={filters?.source}
          options={[
            { value: "ORGANIZATION", label: "Organization" },
            { value: "PLATFORM", label: "Platform" }
          ]}
        />
      </FilterBar>

      {races.length === 0 ? (
        <EmptyState title="No races found" description="There are no races matching the current filters." />
      ) : (
        <div className="grid gap-4">
          {races.map((race) => (
            <article key={race.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={race.status} />
                    <StatusBadge value={race.registrationStatus} />
                    <StatusBadge value={race.source} />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand-orange">
                      <Trophy className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <Link href={`/races/${race.slug}`} className="text-lg font-black text-gray-950 transition hover:text-brand-teal">
                        {race.title}
                      </Link>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">{race.description}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-brand-teal" aria-hidden="true" />
                      {formatDateTime(race.startDate)}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 text-brand-teal" aria-hidden="true" />
                      {race.city}, {race.wilaya}
                    </p>
                    <p className="flex items-center gap-2">
                      <Building2 className="size-4 text-brand-teal" aria-hidden="true" />
                      {race.organization?.name ?? race.organizerName ?? "RaceDZ"}
                    </p>
                    <p className="flex items-center gap-2">
                      <UsersRound className="size-4 text-brand-teal" aria-hidden="true" />
                      {race._count.registrations} registrations
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-gray-500">
                    <span>{race._count.categories} categories</span>
                    <span>{race.availablePlaces ?? "No"} places available</span>
                    <span>From {formatLowestPrice(race.categories.map((category) => category.priceDzd))}</span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:w-40 lg:grid-cols-1">
                  <Link
                    href={`/races/${race.slug}`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:border-brand-teal hover:text-brand-teal"
                  >
                    <Route className="size-4" aria-hidden="true" />
                    View
                  </Link>
                  {race.status === "PENDING_REVIEW" ? (
                    <>
                      <form action={approveRaceAction}>
                        <input type="hidden" name="id" value={race.id} />
                        <Button type="submit" variant="secondary" size="sm" className="w-full">
                          Publish
                        </Button>
                      </form>
                      <form action={rejectRaceAction}>
                        <input type="hidden" name="id" value={race.id} />
                        <Button type="submit" variant="outline" size="sm" className="w-full">
                          Reject
                        </Button>
                      </form>
                    </>
                  ) : null}
                  {race.status === "PUBLISHED" ? (
                    <form action={unpublishRaceAction}>
                      <input type="hidden" name="id" value={race.id} />
                      <Button type="submit" variant="outline" size="sm" className="w-full">
                        Unpublish
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function formatLowestPrice(prices: Array<number | null>) {
  const values = prices.filter((price): price is number => typeof price === "number");

  if (values.length === 0) {
    return formatDzd(undefined);
  }

  return formatDzd(Math.min(...values));
}
