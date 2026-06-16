import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/button";
import { getPrisma } from "@/lib/db";
import { getUserOrganizationSummary } from "@/lib/organizations";
import { OrganizationRequestForm } from "./request-form";

export const dynamic = "force-dynamic";

type OrganizerRequestPageProps = {
  searchParams?: Promise<{
    submitted?: string;
  }>;
};

export default async function OrganizerRequestPage({ searchParams }: OrganizerRequestPageProps) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/organizer/request");
  }

  if (session.user.role === "ORGANIZER" || session.user.role === "ADMIN" || session.user.role === "SUPERADMIN") {
    redirect("/organizer");
  }

  const [user, membership] = await Promise.all([
    getPrisma().user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        email: true,
        phone: true,
        wilaya: true,
        city: true,
        commune: true
      }
    }),
    getUserOrganizationSummary(session.user.id)
  ]);

  if (!user) {
    redirect("/login?callbackUrl=/organizer/request");
  }

  const organization = membership?.organization;
  const canSubmit = !organization || organization.status === "REJECTED" || organization.status === "SUSPENDED";

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section className="space-y-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Organizer access</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950 sm:text-4xl">Request an organization account</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Tell us who organizes the races. Once approved, your organization owner can create events and manage
              participant lists from the organizer dashboard.
            </p>
          </div>

          {params?.submitted ? (
            <StatusPanel
              icon="success"
              title="Request submitted"
              description="Your organization request is pending admin review. You will get organizer access after approval."
            />
          ) : null}

          {organization?.status === "PENDING" ? (
            <StatusPanel
              icon="pending"
              title={`${organization.name} is pending review`}
              description="RaceDZ admins need to approve this organization before you can publish events."
            />
          ) : null}

          {organization?.status === "APPROVED" ? (
            <StatusPanel
              icon="success"
              title={`${organization.name} is approved`}
              description="Your organization is ready. Open the organizer dashboard to create and manage events."
              actionHref="/organizer"
              actionLabel="Open organizer dashboard"
            />
          ) : null}

          {organization?.status === "REJECTED" ? (
            <StatusPanel
              icon="rejected"
              title={`${organization.name} was rejected`}
              description="You can submit a corrected request with updated organization details."
            />
          ) : null}

          {canSubmit ? <OrganizationRequestForm user={user} /> : null}
        </section>

        <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-gray-950">What approval unlocks</h2>
          <div className="mt-4 grid gap-4 text-sm text-gray-600">
            <p className="rounded-lg bg-teal-50 p-3 font-semibold text-brand-teal">Create races for admin review.</p>
            <p className="rounded-lg bg-orange-50 p-3 font-semibold text-brand-orangeDark">Invite organization admins later.</p>
            <p className="rounded-lg bg-gray-50 p-3 font-semibold text-gray-700">Manage participant lists and CSV exports.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusPanel({
  icon,
  title,
  description,
  actionHref,
  actionLabel
}: {
  icon: "success" | "pending" | "rejected";
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const Icon = icon === "success" ? CheckCircle2 : icon === "pending" ? Clock3 : XCircle;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 text-brand-teal" aria-hidden="true" />
        <div>
          <h2 className="font-black text-gray-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
          {actionHref && actionLabel ? (
            <ButtonLink href={actionHref} size="sm" className="mt-4">
              {actionLabel}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
