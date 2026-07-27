import { AlertOctagon, Bug, Route as RouteIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { getAdminClientErrors, getClientErrorBoundaryOptions, getClientErrorStats, type AdminClientErrorRow } from "@/lib/client-errors";
import { AdminShell, EmptyState, SelectFilter, StatCard } from "../_components/admin-ui";
import { deleteClientErrorAction } from "./actions";
import { ClearAllButton } from "./clear-all-button";

export const dynamic = "force-dynamic";

type ErrorsPageProps = {
  searchParams?: Promise<{ q?: string; boundary?: string; platform?: string; page?: string }>;
};

export default async function AdminErrorsPage({ searchParams }: ErrorsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });

  const [{ items, page, totalPages, total }, stats, boundaryOptions] = await Promise.all([
    getAdminClientErrors({ q: filters?.q, boundary: filters?.boundary, platform: filters?.platform }, pagination),
    getClientErrorStats(),
    getClientErrorBoundaryOptions()
  ]);

  return (
    <AdminShell
      title="Client errors"
      description="Crashes reported by error boundaries in the app — the same events sent to Sentry, kept here for a quick DB-side look."
      action={total > 0 ? <ClearAllButton /> : undefined}
    >
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total logged" value={stats.total} icon={Bug} />
        <StatCard label="Last 24h" value={stats.last24h} icon={AlertOctagon} tone="orange" />
        <StatCard label="Distinct routes" value={stats.routeCount} icon={RouteIcon} />
      </section>

      <form action="/admin/errors" className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_auto]">
        <label className="relative">
          <span className="sr-only">Search message or route</span>
          <input
            name="q"
            defaultValue={filters?.q ?? ""}
            placeholder="Search message or route"
            className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <SelectFilter
            name="boundary"
            label="All boundaries"
            defaultValue={filters?.boundary}
            options={[{ value: "__route__", label: "Page load (route-level)" }, ...boundaryOptions.map((value) => ({ value, label: value }))]}
          />
          <SelectFilter
            name="platform"
            label="All platforms"
            defaultValue={filters?.platform}
            options={[
              { value: "android", label: "Android app" },
              { value: "web", label: "Web" }
            ]}
          />
          <Button type="submit" size="sm" variant="secondary">
            Filter
          </Button>
          <ButtonLink href="/admin/errors" size="sm" variant="outline">
            Reset
          </ButtonLink>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={Bug} title="No client errors" description="Crashes reported by the app's error boundaries will show up here." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {items.map((row) => (
              <ClientErrorCard key={row.id} row={row} />
            ))}
          </div>
          <Pagination basePath="/admin/errors" searchParams={filters} page={page} totalPages={totalPages} />
        </div>
      )}
    </AdminShell>
  );
}

function ClientErrorCard({ row }: { row: AdminClientErrorRow }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="red">{row.boundary ?? "Page load"}</Badge>
            <span className="font-mono text-xs text-gray-500">{row.route}</span>
            {row.platform ? <Badge variant="blue">{row.platform}</Badge> : null}
          </div>
          <h2 className="mt-2 break-words text-sm font-black text-gray-950">{row.message}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {row.userName ? (
              <>
                <span className="font-semibold text-gray-700">{row.userName}</span>
                <span className="text-gray-400"> · </span>
                {row.userEmail}
              </>
            ) : (
              "Not signed in"
            )}
            {row.digest ? (
              <>
                <span className="text-gray-400"> · </span>Reference: <span className="font-mono">{row.digest}</span>
              </>
            ) : null}
          </p>
          {row.stack ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-bold text-brand-teal">Stack trace</summary>
              <pre className="mt-1.5 max-h-64 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] leading-5 text-gray-700">{row.stack}</pre>
            </details>
          ) : null}
          {row.context && Object.keys(row.context).length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-bold text-brand-teal">Breadcrumb context</summary>
              <pre className="mt-1.5 max-h-64 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] leading-5 text-gray-700">
                {JSON.stringify(row.context, null, 2)}
              </pre>
            </details>
          ) : null}
          {row.userAgent ? <p className="mt-1.5 truncate text-[11px] text-gray-400">{row.userAgent}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-xs font-semibold text-gray-500">{formatDateTime(row.createdAt)}</p>
          <form action={deleteClientErrorAction}>
            <input type="hidden" name="id" value={row.id} />
            <Button type="submit" size="sm" variant="outline">
              Dismiss
            </Button>
          </form>
        </div>
      </div>
    </article>
  );
}
