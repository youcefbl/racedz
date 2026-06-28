import { notFound } from "next/navigation";
import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getDictionary, getLocale, withLocale } from "@/lib/i18n";
import { translateOrganizerEnum } from "@/lib/organizer-i18n";
import { getOrganizationInvitationByToken } from "@/lib/organizer";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams?: Promise<{ lang?: string }>;
};

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const locale = getLocale((await searchParams)?.lang);
  const t = getDictionary(locale).invite;
  const invitation = await getOrganizationInvitationByToken(token);
  const session = await auth();

  if (!invitation) {
    notFound();
  }

  const isPending = invitation.status === "PENDING";
  const canAccept = isPending && invitation.organizationStatus === "APPROVED";
  const roleLabel = translateOrganizerEnum(locale, invitation.role);

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <Badge variant={isPending ? "orange" : "green"}>{translateOrganizerEnum(locale, invitation.status)}</Badge>
                <Badge variant={invitation.organizationStatus === "APPROVED" ? "green" : "red"}>
                  {translateOrganizerEnum(locale, invitation.organizationStatus)}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black text-gray-950">{t.joinTitle.replace("{organization}", invitation.organizationName)}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                {t.invitedBy.replace("{name}", invitation.invitedByName).replace("{role}", roleLabel)}
              </p>

              <dl className="mt-6 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <Mail className="size-4 text-brand-teal" aria-hidden={true} />
                    {t.invitedEmail}
                  </dt>
                  <dd className="mt-1">{invitation.email}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <ShieldCheck className="size-4 text-brand-teal" aria-hidden={true} />
                    {t.role}
                  </dt>
                  <dd className="mt-1">{roleLabel}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <Building2 className="size-4 text-brand-teal" aria-hidden={true} />
                    {t.organization}
                  </dt>
                  <dd className="mt-1">{invitation.organizationName}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <UserRound className="size-4 text-brand-teal" aria-hidden={true} />
                    {t.invited}
                  </dt>
                  <dd className="mt-1">{formatDate(invitation.createdAt)}</dd>
                </div>
              </dl>
            </div>

            <aside className="border-t border-gray-200 bg-gray-50 p-6 sm:p-8 lg:border-s lg:border-t-0">
              <h2 className="text-xl font-black text-gray-950">{t.acceptTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {t.acceptText.replace("{email}", invitation.email)}
              </p>
              <div className="mt-5 grid gap-3">
                {session?.user ? (
                  <AcceptInviteForm token={token} disabled={!canAccept} locale={locale} />
                ) : (
                  <>
                    <ButtonLink href={withLocale(`/login?callbackUrl=/invite/${token}`, locale)} size="lg">
                      {t.signInToAccept}
                    </ButtonLink>
                    <ButtonLink href={withLocale(`/register?callbackUrl=/invite/${token}`, locale)} variant="outline" size="lg">
                      {t.createAccount}
                    </ButtonLink>
                  </>
                )}
                {!canAccept ? (
                  <p className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700">
                    {t.cannotAccept}
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
