import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { AdminSupportThread } from "@/components/support/admin-support-thread";
import { requireAdmin } from "@/lib/admin";
import { getAdminSupportThread } from "@/lib/support";
import { AdminShell } from "../../_components/admin-ui";

export const dynamic = "force-dynamic";

type AdminSupportThreadPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSupportThreadPage({ params }: AdminSupportThreadPageProps) {
  await requireAdmin();
  const { id } = await params;
  const data = await getAdminSupportThread(id);

  if (!data) {
    notFound();
  }

  return (
    <AdminShell
      title={data.thread.user.name}
      description={data.thread.user.email}
      action={
        <ButtonLink href="/admin/support" variant="outline" size="sm">
          Back to support
        </ButtonLink>
      }
    >
      <AdminSupportThread initial={data} />
    </AdminShell>
  );
}
