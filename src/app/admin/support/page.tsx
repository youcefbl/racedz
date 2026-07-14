import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/admin";
import { parsePagination } from "@/lib/pagination";
import { getAdminSupportThreads } from "@/lib/support";
import { AdminShell, EmptyState } from "../_components/admin-ui";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ searchParams }: { searchParams?: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const filters = await searchParams;
  const q = filters?.q?.trim() ?? "";
  const pagination = parsePagination({ page: filters?.page });
  const { items: threads, page, totalPages } = await getAdminSupportThreads(q, pagination);

  return (
    <AdminShell title="Support chat" description="Direct conversations with runners, most recent first.">
      <form method="get" className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by runner name or email"
            className="h-11 w-full rounded-lg border border-gray-300 ps-9 pe-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-teal px-4 text-sm font-bold text-white transition active:scale-95">
          Search
        </button>
      </form>
      {threads.length === 0 ? (
        <EmptyState
          title={q ? "No matches" : "No conversations"}
          description={q ? `No runners match "${q}".` : "Runner support messages will appear here."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {threads.map((thread, index) => (
            <Link
              key={thread.id}
              href={`/admin/support/${thread.id}`}
              className={index === threads.length - 1 ? "block" : "block border-b border-gray-100"}
            >
              <article className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-gray-50">
                <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-brand-teal">
                  {thread.user.avatarUrl ? (
                    <Image src={thread.user.avatarUrl} alt="" fill sizes="44px" className="object-cover" />
                  ) : (
                    <UserRound className="size-5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-gray-950">{thread.user.name}</p>
                    {thread.status === "CLOSED" ? <Badge variant="default">Resolved</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-gray-500">{thread.lastMessage ?? thread.user.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-xs text-gray-400">{formatDateTime(thread.lastMessageAt)}</span>
                  {thread.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center gap-1 rounded-full bg-brand-orange px-1.5 text-xs font-black text-white">
                      <MessageCircle className="size-3" aria-hidden="true" />
                      {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
                    </span>
                  ) : null}
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}

      <Pagination basePath="/admin/support" searchParams={filters} page={page} totalPages={totalPages} />
    </AdminShell>
  );
}
