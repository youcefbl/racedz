import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "../../_components/admin-ui";
import { ImportRaceForm } from "./import-race-form";

export const dynamic = "force-dynamic";

export default async function ImportRacePage() {
  const session = await requireAdmin();

  if (session.user.role !== "SUPERADMIN") {
    redirect("/admin/races");
  }

  return (
    <AdminShell
      title="Import race from a post"
      description="Upload screenshots and paste the caption. AI prepares a private draft; you verify every key detail before it can be published."
    >
      <div className="max-w-3xl">
        <ImportRaceForm />
      </div>
    </AdminShell>
  );
}
