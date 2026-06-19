import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRaceAnnouncements } from "@/lib/announcements";
import { getAdminRaceForEdit, requireAdmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { AdminShell } from "../../../_components/admin-ui";
import { AdminRaceEditForm } from "./admin-race-edit-form";
import { createAdminAnnouncementAction } from "./actions";

export const dynamic = "force-dynamic";

type AdminRaceEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminRaceEditPage({ params }: AdminRaceEditPageProps) {
  await requireAdmin();
  const { id } = await params;
  const race = await getAdminRaceForEdit(id);

  if (!race) {
    notFound();
  }
  const announcements = await getRaceAnnouncements(race.id);

  return (
    <AdminShell title="Edit race" description="Admin edits are saved immediately and recorded in the audit log.">
      <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_360px]">
        <AdminRaceEditForm race={race} />
        <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="size-5 text-brand-orange" aria-hidden="true" />
            <h2 className="text-xl font-black text-gray-950">Announcements</h2>
          </div>
          <form action={createAdminAnnouncementAction} className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <input type="hidden" name="raceId" value={race.id} />
            <label className="grid gap-1 text-sm font-semibold text-gray-700">
              Title
              <input
                name="title"
                required
                maxLength={120}
                className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-950"
                placeholder="Important race update"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-700">
              Message
              <textarea
                name="body"
                required
                rows={4}
                maxLength={2000}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
                placeholder="Publish an update for registered runners and public visitors."
              />
            </label>
            <Button type="submit" variant="secondary" size="sm" className="w-fit">
              Publish
            </Button>
          </form>
          <div className="mt-4 grid gap-3">
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-normal text-brand-teal">{formatDateTime(announcement.publishedAt)}</p>
                  <h3 className="mt-2 font-black text-gray-950">{announcement.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{announcement.body}</p>
                </article>
              ))
            ) : (
              <p className="rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-600">No announcements yet.</p>
            )}
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}
