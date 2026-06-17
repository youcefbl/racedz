import { notFound } from "next/navigation";
import { getAdminRaceForEdit, requireAdmin } from "@/lib/admin";
import { AdminShell } from "../../../_components/admin-ui";
import { AdminRaceEditForm } from "./admin-race-edit-form";

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

  return (
    <AdminShell title="Edit race" description="Admin edits are saved immediately and recorded in the audit log.">
      <div className="max-w-4xl">
        <AdminRaceEditForm race={race} />
      </div>
    </AdminShell>
  );
}
