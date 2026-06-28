import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/button";
import { getPrisma } from "@/lib/db";
import { getUserOrganizationSummary } from "@/lib/organizations";
import { OrganizationRequestForm } from "./request-form";
import { getLocale, withLocale } from "@/lib/i18n";
import { translateOrganizer } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

type OrganizerRequestPageProps = {
  searchParams?: Promise<{
    submitted?: string;
    lang?: string;
  }>;
};

export default async function OrganizerRequestPage({ searchParams }: OrganizerRequestPageProps) {
  const session = await auth();
  const params = await searchParams;
  const locale = getLocale(params?.lang);
  const t = (text: string) => translateOrganizer(locale, text);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/organizer/request");
  }

  if (session.user.role === "ORGANIZER" || session.user.role === "ADMIN" || session.user.role === "SUPERADMIN") {
    redirect(withLocale("/organizer", locale));
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
            <h1 className="text-3xl font-black text-gray-950 sm:text-4xl">{t("Request an organization account")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              {t("Tell us who organizes the races. Once approved, your organization owner can create events and manage participant lists from the organizer dashboard.")}
            </p>
          </div>

          {params?.submitted ? (
            <StatusPanel
              icon="success"
              title={t("Request submitted")}
              description={t("Your organization request is pending admin review. You will get organizer access after approval.")}
            />
          ) : null}

          {organization?.status === "PENDING" ? (
            <StatusPanel
              icon="pending"
              title={`${organization.name} ${t("is pending review")}`}
              description={t("ZidRun admins need to approve this organization before you can publish events.")}
            />
          ) : null}

          {organization?.status === "APPROVED" ? (
            <StatusPanel
              icon="success"
              title={`${organization.name} ${t("is approved")}`}
              description={t("Your organization is ready. Open the organizer dashboard to create and manage events.")}
              actionHref={withLocale("/organizer", locale)}
              actionLabel={t("Open organizer dashboard")}
            />
          ) : null}

          {organization?.status === "REJECTED" ? (
            <StatusPanel
              icon="rejected"
              title={`${organization.name} ${t("was rejected")}`}
              description={t("You can submit a corrected request with updated organization details.")}
            />
          ) : null}

          {canSubmit ? <OrganizationRequestForm user={user} /> : null}
        </section>

        <aside className="h-fit rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950">{t("What approval unlocks")}</h2>
          <ul className="mt-4 grid gap-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              <span>{t("Create races for admin review.")}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              <span>{t("Invite organization admins later.")}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              <span>{t("Manage participant lists and CSV exports.")}</span>
            </li>
          </ul>
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
  const iconColor = icon === "success" ? "text-green-700" : icon === "pending" ? "text-brand-orange" : "text-red-700";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <Icon className={`mt-0.5 size-5 shrink-0 ${iconColor}`} aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-bold text-gray-950 break-words">{title}</h2>
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
