import { notFound } from "next/navigation";
import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getOrganizationInvitationByToken } from "@/lib/organizer";
import { AcceptInviteForm } from "./accept-invite-form";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invitation = await getOrganizationInvitationByToken(token);
  const session = await auth();

  if (!invitation) {
    notFound();
  }

  const isPending = invitation.status === "PENDING";
  const canAccept = isPending && invitation.organizationStatus === "APPROVED";

  return (
    <div className="bg-gray-50">
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <Badge variant={isPending ? "orange" : "green"}>{formatEnumLabel(invitation.status)}</Badge>
                <Badge variant={invitation.organizationStatus === "APPROVED" ? "green" : "red"}>
                  {formatEnumLabel(invitation.organizationStatus)}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black text-gray-950">Join {invitation.organizationName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                {invitation.invitedByName} invited you to help manage race operations on RaceDZ. Accepting adds your account to
                the organization with {formatEnumLabel(invitation.role)} access.
              </p>

              <dl className="mt-6 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <Mail className="size-4 text-brand-teal" aria-hidden={true} />
                    Invited email
                  </dt>
                  <dd className="mt-1">{invitation.email}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <ShieldCheck className="size-4 text-brand-teal" aria-hidden={true} />
                    Role
                  </dt>
                  <dd className="mt-1">{formatEnumLabel(invitation.role)}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <Building2 className="size-4 text-brand-teal" aria-hidden={true} />
                    Organization
                  </dt>
                  <dd className="mt-1">{invitation.organizationName}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <dt className="flex items-center gap-2 font-bold text-gray-950">
                    <UserRound className="size-4 text-brand-teal" aria-hidden={true} />
                    Invited
                  </dt>
                  <dd className="mt-1">{formatDate(invitation.createdAt)}</dd>
                </div>
              </dl>
            </div>

            <aside className="border-t border-gray-200 bg-gray-50 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <h2 className="text-xl font-black text-gray-950">Accept access</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Sign in with {invitation.email}. Invitations cannot be accepted from a different email account.
              </p>
              <div className="mt-5 grid gap-3">
                {session?.user ? (
                  <AcceptInviteForm token={token} disabled={!canAccept} />
                ) : (
                  <>
                    <ButtonLink href={`/login?callbackUrl=/invite/${token}`} size="lg">
                      Sign in to accept
                    </ButtonLink>
                    <ButtonLink href={`/register?callbackUrl=/invite/${token}`} variant="outline" size="lg">
                      Create account
                    </ButtonLink>
                  </>
                )}
                {!canAccept ? (
                  <p className="rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700">
                    This invitation cannot be accepted in its current status.
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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
