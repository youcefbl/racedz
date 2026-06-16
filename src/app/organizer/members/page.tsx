import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { getOrganizerMembers, requireApprovedOrganizer } from "@/lib/organizer";
import { InviteMemberForm } from "./invite-member-form";

export const dynamic = "force-dynamic";

export default async function OrganizerMembersPage() {
  const { membership, organization } = await requireApprovedOrganizer();
  const data = await getOrganizerMembers(organization.id);
  const canInvite = membership.role === "OWNER" || membership.role === "ADMIN";

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-normal text-brand-teal">Organizer</p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">Organization members</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Manage users who can help operate {organization.name}. Invitations are stored now; email delivery and accept flow come next.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4">
                <h2 className="font-black text-gray-950">Active members</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {data?.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-bold text-gray-950">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{member.user.email}</p>
                    </div>
                    <Badge variant={member.role === "OWNER" ? "orange" : "teal"}>{member.role}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 p-4">
                <h2 className="font-black text-gray-950">Pending invitations</h2>
              </div>
              {data?.invitations.length ? (
                <div className="divide-y divide-gray-200">
                  {data.invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-bold text-gray-950">{invitation.email}</p>
                        <p className="text-sm text-gray-500">Invited {formatDate(invitation.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="teal">{invitation.role}</Badge>
                        <Badge variant={invitation.status === "PENDING" ? "orange" : "green"}>{invitation.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-sm text-gray-500">No invitations yet.</p>
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
