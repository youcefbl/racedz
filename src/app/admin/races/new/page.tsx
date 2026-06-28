import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "../../_components/admin-ui";
import { PlatformRaceForm } from "./platform-race-form";

export const dynamic = "force-dynamic";

export default async function NewPlatformRacePage() {
  const session = await requireAdmin();

  if (session.user.role !== "SUPERADMIN") {
    redirect("/admin/races");
  }

  return (
    <AdminShell
      title="Create platform race"
      description="Publish a ZidRun-created event directly with registration closed by default unless you choose to open it."
    >
      <div className="max-w-6xl">
        <PlatformRaceForm />
      </div>
    </AdminShell>
  );
}
