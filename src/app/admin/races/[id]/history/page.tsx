import { redirect } from "next/navigation";
import { Clock3, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { getAdminRaceEditHistory, requireAdmin } from "@/lib/admin";
import { AdminShell, EmptyState } from "../../../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminRaceHistoryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminRaceHistoryPage({ params }: AdminRaceHistoryPageProps) {
  const session = await requireAdmin();

  if (session.user.role !== "SUPERADMIN") {
    redirect("/admin/races");
  }

  const { id } = await params;
  const history = await getAdminRaceEditHistory(id);
  const title = history[0]?.raceTitle ?? "Race";

  return (
    <AdminShell
      title={`${title} history`}
      description="Timestamped organizer changes for race details and categories."
      action={
        <ButtonLink href="/admin/races" variant="outline">
          Back to races
        </ButtonLink>
      }
    >
      {history.length === 0 ? (
        <EmptyState title="No edit history" description="No organizer changes have been recorded for this race yet." />
      ) : (
        <div className="grid gap-4">
          {history.map((entry) => (
            <article key={entry.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="teal">{formatAction(entry.action)}</Badge>
                    <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                      <Clock3 className="size-3.5" aria-hidden={true} />
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-black text-gray-950">{entry.summary ?? formatAction(entry.action)}</h2>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <UserRound className="size-4 text-brand-teal" aria-hidden={true} />
                    {entry.editorName} · {entry.editorEmail}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-[640px] divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-normal text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Before</th>
                      <th className="px-3 py-2">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entry.changes.map((change, index) => (
                      <tr key={`${entry.id}-${change.field}-${index}`}>
                        <td className="px-3 py-2 font-semibold text-gray-950">{change.field}</td>
                        <td className="max-w-xs px-3 py-2 text-gray-600">{formatHistoryValue(change.before)}</td>
                        <td className="max-w-xs px-3 py-2 text-gray-600">{formatHistoryValue(change.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function formatAction(value: string) {
  return value
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHistoryValue(value: unknown) {
  if (value == null) {
    return "Empty";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}
