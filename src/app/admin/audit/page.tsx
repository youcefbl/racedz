import { Clock3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { getAdminAuditLogs, requireAdmin } from "@/lib/admin";
import { AdminShell, EmptyState } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();
  const logs = await getAdminAuditLogs();

  return (
    <AdminShell title="Audit log" description="Review recent admin and superadmin actions across approvals, race edits, and role changes.">
      {logs.length === 0 ? (
        <EmptyState title="No audit entries" description="Admin actions will appear here after approvals, rejections, edits, and role changes." />
      ) : (
        <div className="grid gap-3">
          {logs.map((log) => (
            <article key={log.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
                    <ShieldCheck className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="blue">{formatAction(log.action)}</Badge>
                      <span className="text-xs font-semibold text-gray-500">{log.targetType}</span>
                    </div>
                    <h2 className="mt-2 text-sm font-black text-gray-950">{log.summary ?? log.action}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {log.actorName} · {log.actorEmail}
                    </p>
                    <p className="mt-1 break-all text-xs font-semibold text-gray-400">Target: {log.targetId}</p>
                  </div>
                </div>
                <p className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <Clock3 className="size-4 text-brand-orange" aria-hidden="true" />
                  {formatDateTime(log.createdAt)}
                </p>
              </div>
            </article>
          ))}
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
