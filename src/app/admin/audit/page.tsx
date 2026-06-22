import { Clock3, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { ADMIN_AUDIT_RETENTION_DAYS, getAdminAuditLogs, requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { AdminShell, EmptyState, SelectFilter } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminAuditPageProps = {
  searchParams?: Promise<{
    actor?: string;
    targetType?: string;
    action?: string;
    page?: string;
  }>;
};

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const { items: logs, page, totalPages } = await getAdminAuditLogs(
    {
      actor: filters?.actor,
      targetType: filters?.targetType,
      action: filters?.action
    },
    pagination
  );

  return (
    <AdminShell title="Audit log" description="Review recent admin and superadmin actions across approvals, race edits, and role changes.">
      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
        Audit entries are retained for {ADMIN_AUDIT_RETENTION_DAYS} days during the MVP period.
      </div>
      <form action="/admin/audit" className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm lg:grid-cols-[1fr_auto]">
        <label className="relative">
          <span className="sr-only">Filter by actor</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            name="actor"
            defaultValue={filters?.actor ?? ""}
            placeholder="Filter actor name or email"
            className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <SelectFilter
            name="targetType"
            label="All target types"
            defaultValue={filters?.targetType}
            options={[
              { value: "Organization", label: "Organization" },
              { value: "RaceEvent", label: "Race event" },
              { value: "User", label: "User" }
            ]}
          />
          <SelectFilter
            name="action"
            label="All actions"
            defaultValue={filters?.action}
            options={[
              { value: "organization.approved", label: "Organization approved" },
              { value: "organization.rejected", label: "Organization rejected" },
              { value: "race.approved", label: "Race approved" },
              { value: "race.rejected", label: "Race rejected" },
              { value: "race.unpublished", label: "Race unpublished" },
              { value: "race.published", label: "Race published" },
              { value: "race.updated", label: "Race updated" },
              { value: "user.role_updated", label: "User role updated" }
            ]}
          />
          <Button type="submit" size="sm" variant="secondary">
            Filter
          </Button>
          <ButtonLink href="/admin/audit" size="sm" variant="outline">
            Reset
          </ButtonLink>
        </div>
      </form>
      {logs.length === 0 ? (
        <EmptyState title="No audit entries" description="Admin actions will appear here after approvals, rejections, edits, and role changes." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {logs.map((log) => {
              const metadataItems = getAuditMetadataItems(log.metadata);

              return (
                <article key={log.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                        <ShieldCheck className="size-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="blue">{formatAction(log.action)}</Badge>
                          <span className="text-xs font-semibold text-gray-500">{log.targetType}</span>
                        </div>
                        <h2 className="mt-2 text-sm font-black text-gray-950">{log.summary ?? log.action}</h2>
                        <p className="mt-1 text-sm text-gray-600">
                          {log.actorName} · {log.actorEmail}
                        </p>
                        <p className="mt-1 break-all text-xs font-semibold text-gray-400">Target: {log.targetId}</p>
                        {metadataItems.length ? (
                          <dl className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3">
                            {metadataItems.map((item) => (
                              <div key={item.key} className="grid gap-1 text-xs sm:grid-cols-[150px_1fr]">
                                <dt className="font-bold text-gray-500">{item.label}</dt>
                                <dd className="min-w-0 text-gray-700">
                                  {item.before !== undefined || item.after !== undefined ? (
                                    <span className="grid gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                      <span className="break-words rounded-md bg-white px-2 py-1 font-semibold text-gray-600">
                                        {formatMetadataValue(item.before)}
                                      </span>
                                      <span className="text-gray-400">to</span>
                                      <span className="break-words rounded-md bg-white px-2 py-1 font-semibold text-gray-900">
                                        {formatMetadataValue(item.after)}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="break-words font-semibold">{formatMetadataValue(item.value)}</span>
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    </div>
                    <p className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                      <Clock3 className="size-4 text-brand-orange" aria-hidden="true" />
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination basePath="/admin/audit" searchParams={filters} page={page} totalPages={totalPages} />
        </div>
      )}
    </AdminShell>
  );
}

function formatAction(action: string) {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace("_", " "))
    .join(" ");
}

type AuditMetadataItem = {
  key: string;
  label: string;
  value?: unknown;
  before?: unknown;
  after?: unknown;
};

function getAuditMetadataItems(metadata: unknown): AuditMetadataItem[] {
  if (!isRecord(metadata)) {
    return [];
  }

  const changes = Array.isArray(metadata.changes) ? metadata.changes : [];
  const changeItems = changes.flatMap((change, index) => {
    if (!isRecord(change) || typeof change.field !== "string") {
      return [];
    }

    return [
      {
        key: `change-${change.field}-${index}`,
        label: formatMetadataLabel(change.field),
        before: change.before,
        after: change.after
      }
    ];
  });

  const directItems: AuditMetadataItem[] = [];

  if ("previousRole" in metadata || "nextRole" in metadata) {
    directItems.push({
      key: "role",
      label: "Role",
      before: metadata.previousRole,
      after: metadata.nextRole
    });
  }

  if (typeof metadata.reason === "string" && metadata.reason.trim().length > 0) {
    directItems.push({
      key: "reason",
      label: "Reason",
      value: metadata.reason
    });
  }

  const fallbackItems = Object.entries(metadata)
    .filter(([key]) => !["changes", "previousRole", "nextRole", "reason"].includes(key))
    .map(([key, value]) => ({
      key,
      label: formatMetadataLabel(key),
      value
    }));

  return [...changeItems, ...directItems, ...fallbackItems];
}

function formatMetadataLabel(value: string) {
  const labels: Record<string, string> = {
    title: "Title",
    description: "Description",
    raceType: "Race type",
    status: "Publication status",
    registrationStatus: "Registration status",
    startDate: "Start date",
    registrationCloseAt: "Registration deadline",
    wilaya: "Wilaya",
    city: "City",
    commune: "Commune",
    address: "Address",
    organizerName: "Organizer",
    organizerUrl: "Organizer link",
    contactEmail: "Contact email",
    contactPhone: "Contact phone",
    maxParticipants: "Capacity",
    mainImageUrl: "Race image"
  };

  return labels[value] ?? value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Empty";
  }

  if (value instanceof Date) {
    return formatDateTime(value);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
