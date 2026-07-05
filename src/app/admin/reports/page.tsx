import { CheckCircle2, ExternalLink, Flag, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import {
  getAdminReports,
  getReportStatusCounts,
  REPORT_CATEGORY_LABELS,
  REPORTABLE_TARGET_TYPES,
  type AdminReportRow
} from "@/lib/reports";
import { AdminShell, EmptyState, SelectFilter, StatCard } from "../_components/admin-ui";
import { dismissReportAction, resolveReportAction } from "./actions";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: Promise<{ status?: string; category?: string; targetType?: string; page?: string }>;
};

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });

  const [{ items, page, totalPages }, counts] = await Promise.all([
    getAdminReports(
      { status: filters?.status, category: filters?.category, targetType: filters?.targetType },
      pagination
    ),
    getReportStatusCounts()
  ]);

  return (
    <AdminShell
      title="Reports"
      description="Content flagged by users. Triage each report, open the target to take action, then resolve or dismiss."
    >
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={counts.OPEN} icon={ShieldAlert} tone="orange" />
        <StatCard label="Actioned" value={counts.ACTIONED} icon={CheckCircle2} />
        <StatCard label="Dismissed" value={counts.DISMISSED} icon={XCircle} />
      </section>

      <form action="/admin/reports" className="mb-4 flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <SelectFilter
          name="status"
          label="All statuses"
          defaultValue={filters?.status}
          options={[
            { value: "OPEN", label: "Open" },
            { value: "ACTIONED", label: "Actioned" },
            { value: "DISMISSED", label: "Dismissed" }
          ]}
        />
        <SelectFilter
          name="category"
          label="All categories"
          defaultValue={filters?.category}
          options={Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <SelectFilter
          name="targetType"
          label="All content types"
          defaultValue={filters?.targetType}
          options={REPORTABLE_TARGET_TYPES.map((value) => ({ value, label: value }))}
        />
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
        <ButtonLink href="/admin/reports" size="sm" variant="outline">
          Reset
        </ButtonLink>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={Flag} title="No reports" description="Flagged content will appear here for review." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {items.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
          <Pagination basePath="/admin/reports" searchParams={filters} page={page} totalPages={totalPages} />
        </div>
      )}
    </AdminShell>
  );
}

function ReportCard({ report }: { report: AdminReportRow }) {
  const statusVariant = report.status === "OPEN" ? "orange" : report.status === "ACTIONED" ? "green" : "default";

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="red">{REPORT_CATEGORY_LABELS[report.category]}</Badge>
            <Badge variant={statusVariant}>{report.status}</Badge>
            <span className="text-xs font-semibold text-gray-500">{report.targetType}</span>
          </div>
          <h2 className="mt-2 flex flex-wrap items-center gap-2 break-words text-sm font-black text-gray-950">
            {report.targetLabel}
            {report.targetAdminHref ? (
              <a
                href={report.targetAdminHref}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-teal hover:underline"
              >
                Open <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </h2>
          {report.details ? <p className="mt-1 break-words text-sm text-gray-600">“{report.details}”</p> : null}
          <p className="mt-1 text-xs text-gray-500">
            Reported by <span className="font-semibold text-gray-700">{report.reporterName}</span>
            <span className="text-gray-400"> · </span>
            {report.reporterEmail}
          </p>
          {report.resolutionNote ? (
            <p className="mt-2 rounded-md bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600">
              Resolution: {report.resolutionNote}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 text-xs font-semibold text-gray-500">{formatDateTime(report.createdAt)}</p>
      </div>

      {report.status === "OPEN" ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
          <form action={resolveReportAction} className="flex flex-1 flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={report.id} />
            <label className="min-w-48 flex-1">
              <span className="sr-only">Resolution note</span>
              <input
                name="note"
                placeholder="Resolution note (optional)"
                className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <Button type="submit" size="sm" variant="secondary">
              Mark actioned
            </Button>
          </form>
          <form action={dismissReportAction}>
            <input type="hidden" name="id" value={report.id} />
            <Button type="submit" size="sm" variant="outline">
              Dismiss
            </Button>
          </form>
        </div>
      ) : null}
    </article>
  );
}
