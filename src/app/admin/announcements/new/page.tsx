import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "../../_components/admin-ui";
import { ComposeForm } from "./compose-form";

export const dynamic = "force-dynamic";

export default async function NewBroadcastPage() {
  await requireAdmin();

  return (
    <AdminShell
      title="New broadcast"
      description="Compose a message, pick your audience, and send it by in-app notification, email, and push."
    >
      <ComposeForm />
    </AdminShell>
  );
}
