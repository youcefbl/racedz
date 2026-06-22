import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { getOrganizerMembers, requireApprovedOrganizer } from "@/lib/organizer";
import { CopyInviteLink } from "./copy-invite-link";
import { InviteMemberForm } from "./invite-member-form";
import { InvitationControls } from "./invitation-controls";
import { MemberControls } from "./member-controls";
import { getLocale } from "@/lib/i18n";
import { translateOrganizer, translateOrganizerEnum } from "@/lib/organizer-i18n";

export const dynamic = "force-dynamic";

export default async function OrganizerMembersPage({ searchParams }: { searchParams?: Promise<{ lang?: string }> }) {
  const locale = getLocale((await searchParams)?.lang);
  const t = (text: string) => translateOrganizer(locale, text);
  const { membership, organization } = await requireApprovedOrganizer();
  const data = await getOrganizerMembers(organization.id);
  const canInvite = membership.role === "OWNER" || membership.role === "ADMIN";
  const canManageMembers = membership.role === "OWNER" || membership.role === "ADMIN";

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">{t("Organizer")}</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">{t("Organization members")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Manage users who can help operate {organization.name}. Send pending invite links to teammates so they can accept access.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4">
                <h2 className="font-black text-gray-950">{t("Active members")}</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {data?.members.map((member) => {
                  const canManageMember =
                    canManageMembers &&
                    member.id !== membership.id &&
                    (membership.role === "OWNER" || member.role !== "OWNER");

                  return (
                    <div key={member.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_260px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-gray-950">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                          <Badge variant={member.role === "OWNER" ? "orange" : "teal"}>{translateOrganizerEnum(locale, member.role)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{member.user.email}</p>
                        {member.id === membership.id ? <p className="mt-2 text-xs font-semibold text-gray-400">{t("Your access")}</p> : null}
                      </div>
                      <MemberControls
                        memberId={member.id}
                        currentRole={member.role}
                        canManage={canManageMember}
                        canAssignOwner={membership.role === "OWNER"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4">
                <h2 className="font-black text-gray-950">{t("Invitations")}</h2>
              </div>
              {data?.invitations.length ? (
                <div className="divide-y divide-gray-200">
                  {data.invitations.map((invitation) => {
                    const isPending = invitation.status === "PENDING";
                    const statusVariant = invitation.status === "ACCEPTED" ? "green" : invitation.status === "REVOKED" ? "red" : "orange";

                    return (
                      <div key={invitation.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-950">{invitation.email}</p>
                          <p className="text-sm text-gray-500">
                            Invited {formatDate(invitation.createdAt)}
                            {invitation.acceptedAt ? ` · accepted ${formatDate(invitation.acceptedAt)}` : ""}
                          </p>
                          {isPending ? <CopyInviteLink path={`/invite/${invitation.token}`} /> : null}
                        </div>
                        <div className="grid content-start gap-3">
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Badge variant="teal">{translateOrganizerEnum(locale, invitation.role)}</Badge>
                            <Badge variant={statusVariant}>{translateOrganizerEnum(locale, invitation.status)}</Badge>
                          </div>
                          {isPending ? <InvitationControls invitationId={invitation.id} canManage={canInvite} /> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-4 text-sm text-gray-500">{t("No invitations yet.")}</p>
              )}
            </div>
          </section>

          <aside>
            <InviteMemberForm canInvite={canInvite} />
          </aside>
        </div>
      </div>
    </div>
  );
}
