import { Megaphone, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { getAdminBroadcasts, type AdminBroadcastRow } from "@/lib/broadcasts";
import { AdminShell, EmptyState } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

type AnnouncementsPageProps = {
  searchParams?: Promise<{ page?: string }>;
};

export default async function AdminAnnouncementsPage({ searchParams }: AnnouncementsPageProps) {
  await requireAdmin();
  const filters = await searchParams;
  const pagination = parsePagination({ page: filters?.page });
  const { items, page, totalPages } = await getAdminBroadcasts(pagination);

  return (
    <AdminShell
      title="Announcements"
      description="Send an email, push, and in-app message to a segment of your users — new races, product news, reminders."
      action={
        <ButtonLink href="/admin/announcements/new" size="lg">
          <Plus className="size-5" aria-hidden="true" />
          New broadcast
        </ButtonLink>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No broadcasts yet"
          description="Compose your first announcement to reach runners by email, push, and in-app notification."
          action={
            <ButtonLink href="/admin/announcements/new" size="sm">
              New broadcast
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {items.map((broadcast) => (
              <BroadcastCard key={broadcast.id} broadcast={broadcast} />
            ))}
          </div>
          <Pagination basePath="/admin/announcements" searchParams={filters} page={page} totalPages={totalPages} />
        </div>
      )}
    </AdminShell>
  );
}

function BroadcastCard({ broadcast }: { broadcast: AdminBroadcastRow }) {
  const statusVariant =
    broadcast.status === "SENT"
      ? "green"
      : broadcast.status === "SENDING"
        ? "orange"
        : broadcast.status === "FAILED"
          ? "red"
          : "default";

  const progress = broadcast.totalRecipients > 0 ? Math.round((broadcast.sentCount / broadcast.totalRecipients) * 100) : 0;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{broadcast.status}</Badge>
            {broadcast.channels.map((channel) => (
              <span key={channel} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                {channel === "IN_APP" ? "In-app" : channel === "EMAIL" ? "Email" : "Push"}
              </span>
            ))}
          </div>
          <h2 className="mt-2 break-words text-sm font-black text-gray-950">{broadcast.title}</h2>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {broadcast.sentCount} / {broadcast.totalRecipients} delivered
            {broadcast.failedCount > 0 ? <span className="text-red-600"> · {broadcast.failedCount} failed</span> : null}
            {broadcast.status === "SENDING" ? <span className="text-gray-400"> · {progress}%</span> : null}
          </p>
        </div>
        <p className="shrink-0 text-xs font-semibold text-gray-500">{formatDateTime(broadcast.sentAt ?? broadcast.createdAt)}</p>
      </div>
    </article>
  );
}
