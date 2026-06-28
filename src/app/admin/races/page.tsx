import Link from "next/link";
import { Building2, CalendarDays, History, MapPin, Pencil, Route, Trophy, UsersRound } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatDzd } from "@/lib/format";
import { getAdminRaces, requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { approveRaceAction, publishRaceAction, rejectRaceAction, unpublishRaceAction } from "../actions";
import { AdminShell, EmptyState, FilterBar, SelectFilter, StatusBadge } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminRacesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    registrationStatus?: string;
    source?: string;
    page?: string;
  }>;
};

export default async function AdminRacesPage({ searchParams }: AdminRacesPageProps) {
  const session = await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const { items: races, page, totalPages } = await getAdminRaces(
    {
      q: filters?.q,
      status: filters?.status,
      registrationStatus: filters?.registrationStatus,
      source: filters?.source
    },
    pagination
  );

  const hasActiveFilters = Boolean(
    filters?.q || filters?.status || filters?.registrationStatus || filters?.source
  );

  return (
    <AdminShell
      title="Races"
      description="Search races, review organization-created events, and control public publication."
      action={
        session.user.role === "SUPERADMIN" ? (
          <ButtonLink href="/admin/races/new" variant="secondary">
            Create platform race
          </ButtonLink>
        ) : null
      }
    >
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
        <EmptyState
          icon={Trophy}
          title="No races found"
          description={
            hasActiveFilters
              ? "No races match the current filters. Try clearing them to see all races."
              : "There are no races yet."
          }
          action={
            hasActiveFilters ? (
              <ButtonLink href="/admin/races" variant="outline" size="sm">
                Reset filters
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {races.map((race) => (
            <article key={race.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand-orange">
                    <Trophy className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/races/${race.slug}`}
                      className="block break-words text-lg font-semibold leading-snug text-gray-950 transition hover:text-brand-teal"
                    >
                      {race.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-gray-600">{race.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={race.status} />
                  <StatusBadge value={race.registrationStatus} />
                  <StatusBadge value={race.source} />
                </div>

                <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                  <p className="flex min-w-0 items-center gap-2">
                    <CalendarDays className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                    <span className="truncate">{formatDateTime(race.startDate)}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                    <span className="truncate">{race.city}, {race.wilaya}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-2">
                    <Building2 className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                    <span className="truncate">{race.organization?.name ?? race.organizerName ?? "ZidRun"}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-2">
                    <UsersRound className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
                    <span className="truncate">{race._count.registrations} registrations</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-gray-500">
                  <span>{race._count.categories} categories</span>
                  <span aria-hidden="true">·</span>
                  <span>{race.availablePlaces ?? "No"} places available</span>
                  <span aria-hidden="true">·</span>
                  <span>From {formatLowestPrice(race.categories.map((category: { priceDzd: number | null }) => category.priceDzd))}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
                  {race.status === "PENDING_REVIEW" ? (
                    <>
                      <form action={approveRaceAction}>
                        <input type="hidden" name="id" value={race.id} />
                        <Button type="submit" variant="secondary" size="sm" className="min-h-11 sm:min-h-9">
                          Approve &amp; publish
                        </Button>
                      </form>
                      <form action={rejectRaceAction}>
                        <input type="hidden" name="id" value={race.id} />
                        <Button type="submit" variant="ghost" size="sm" className="min-h-11 text-red-700 hover:bg-red-50 sm:min-h-9">
                          Reject
                        </Button>
                      </form>
                    </>
                  ) : race.status === "DRAFT" ? (
                    <form action={publishRaceAction}>
                      <input type="hidden" name="id" value={race.id} />
                      <Button type="submit" variant="secondary" size="sm" className="min-h-11 sm:min-h-9">
                        Publish
                      </Button>
                    </form>
                  ) : race.status === "PUBLISHED" ? (
                    <form action={unpublishRaceAction}>
                      <input type="hidden" name="id" value={race.id} />
                      <Button type="submit" variant="ghost" size="sm" className="min-h-11 text-red-700 hover:bg-red-50 sm:min-h-9">
                        Unpublish
                      </Button>
                    </form>
                  ) : null}

                  <ButtonLink href={`/races/${race.slug}`} variant="outline" size="sm" className="min-h-11 sm:min-h-9">
                    <Route className="size-4" aria-hidden="true" />
                    View
                  </ButtonLink>

                  <span className="ml-auto flex flex-wrap items-center gap-1">
                    <ButtonLink href={`/admin/races/${race.id}/edit`} variant="ghost" size="sm" className="min-h-11 sm:min-h-9">
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </ButtonLink>
                    {session.user.role === "SUPERADMIN" ? (
                      <ButtonLink href={`/admin/races/${race.id}/history`} variant="ghost" size="sm" className="min-h-11 sm:min-h-9">
                        <History className="size-4" aria-hidden="true" />
                        History
                      </ButtonLink>
                    ) : null}
                  </span>
                </div>
              </div>
            </article>
            ))}
          </div>
          <Pagination basePath="/admin/races" searchParams={filters} page={page} totalPages={totalPages} />
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
