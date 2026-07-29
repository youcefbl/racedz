"use client";

import { AlertCircle, Globe, Lock, LogOut, Shield, ShieldOff, Trash2, UserPlus, Users } from "lucide-react";
import { useActionState } from "react";
import {
  inviteGroupMemberAction,
  leaveGroupAction,
  removeGroupMemberAction,
  updateGroupMemberRoleAction,
  type GroupFormState
} from "@/app/account/groups/actions";
import { CopyLinkButton } from "@/components/groups/groups-list-view";
import { Button } from "@/components/ui/button";
import type { CoachLocale } from "@/components/coach/types";
import type { GroupDetail, GroupFeedRun } from "@/lib/groups";

const copy = {
  en: {
    members: "members",
    shareLink: "Share link",
    shareLinkHint: "Anyone with this link can join immediately — treat it like a password if the group is private.",
    invite: "Invite by email",
    invitePlaceholder: "runner@example.com",
    inviteBtn: "Send invite",
    inviting: "Sending…",
    inviteSentAdded: "They're already on ZidRun — added to the group.",
    inviteSentEmail: "Invite email sent.",
    membersTitle: "Members",
    makeAdmin: "Make admin",
    removeAdmin: "Remove admin",
    remove: "Remove",
    you: "You",
    leave: "Leave group",
    feedTitle: "Group runs",
    feedEmpty: "No runs from this group yet.",
    km: "km",
    admin: "Admin",
    member: "Member"
  },
  fr: {
    members: "membres",
    shareLink: "Lien de partage",
    shareLinkHint: "Toute personne ayant ce lien peut rejoindre immédiatement — traitez-le comme un mot de passe si le groupe est privé.",
    invite: "Inviter par e-mail",
    invitePlaceholder: "coureur@example.com",
    inviteBtn: "Envoyer l'invitation",
    inviting: "Envoi…",
    inviteSentAdded: "Déjà sur ZidRun — ajouté au groupe.",
    inviteSentEmail: "Invitation envoyée par e-mail.",
    membersTitle: "Membres",
    makeAdmin: "Nommer admin",
    removeAdmin: "Retirer admin",
    remove: "Retirer",
    you: "Vous",
    leave: "Quitter le groupe",
    feedTitle: "Courses du groupe",
    feedEmpty: "Aucune course de ce groupe pour l'instant.",
    km: "km",
    admin: "Admin",
    member: "Membre"
  },
  ar: {
    members: "أعضاء",
    shareLink: "رابط المشاركة",
    shareLinkHint: "أي شخص لديه هذا الرابط يمكنه الانضمام فورًا — تعامل معه ككلمة سر إذا كانت المجموعة خاصة.",
    invite: "دعوة عبر البريد الإلكتروني",
    invitePlaceholder: "runner@example.com",
    inviteBtn: "إرسال الدعوة",
    inviting: "جارٍ الإرسال…",
    inviteSentAdded: "موجود مسبقًا على ZidRun — تمت إضافته إلى المجموعة.",
    inviteSentEmail: "تم إرسال الدعوة بالبريد الإلكتروني.",
    membersTitle: "الأعضاء",
    makeAdmin: "تعيين كمشرف",
    removeAdmin: "إزالة الإشراف",
    remove: "إزالة",
    you: "أنت",
    leave: "مغادرة المجموعة",
    feedTitle: "جريات المجموعة",
    feedEmpty: "لا توجد جريات لهذه المجموعة بعد.",
    km: "كم",
    admin: "مشرف",
    member: "عضو"
  }
} as const;

function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} loading="lazy" decoding="async" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-teal-50 font-black text-brand-teal"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials || "R"}
    </span>
  );
}

function formatDate(iso: string, locale: CoachLocale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar" : locale, { month: "short", day: "numeric" });
}

function formatPace(secondsPerKm: number): string {
  if (!secondsPerKm || secondsPerKm <= 0) return "—";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

const initialInviteState: GroupFormState = {};

function InviteForm({ groupId, locale }: { groupId: string; locale: CoachLocale }) {
  const t = copy[locale];
  const [state, formAction, pending] = useActionState(inviteGroupMemberAction, initialInviteState);

  return (
    <form action={formAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="lang" value={locale} />
      <input
        type="email"
        name="email"
        required
        placeholder={t.invitePlaceholder}
        className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-950 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
      />
      <Button type="submit" size="sm" disabled={pending}>
        <UserPlus className="size-4" aria-hidden="true" />
        {pending ? t.inviting : t.inviteBtn}
      </Button>
      {state.error ? (
        <p className="w-full text-sm font-semibold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {!state.error && state.added !== undefined ? (
        <p className="w-full text-sm font-semibold text-green-700">{state.added ? t.inviteSentAdded : t.inviteSentEmail}</p>
      ) : null}
    </form>
  );
}

export function GroupDetailView({
  group,
  feed,
  locale,
  actionError
}: {
  group: GroupDetail;
  feed: GroupFeedRun[];
  locale: CoachLocale;
  actionError: string | null;
}) {
  const t = copy[locale];
  const rtl = locale === "ar";
  const isAdmin = group.viewerRole === "ADMIN";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={group.name} url={group.pictureUrl} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black text-gray-950">{group.name}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-gray-500">
            {group.isPrivate ? <Lock className="size-4" aria-hidden="true" /> : <Globe className="size-4" aria-hidden="true" />}
            {group.members.length} {t.members}
          </p>
        </div>
      </div>

      {actionError ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {actionError}
        </p>
      ) : null}

      {isAdmin ? (
        <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-gray-500">{t.shareLink}</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={group.joinUrl}
                className="h-11 min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-600"
              />
              <CopyLinkButton url={group.joinUrl} locale={locale} />
            </div>
            <p className="mt-1.5 text-xs font-semibold text-gray-400">{t.shareLinkHint}</p>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-gray-500">{t.invite}</p>
            <InviteForm groupId={group.id} locale={locale} />
          </div>
        </div>
      ) : null}

      <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-gray-500">{t.membersTitle}</h2>
        <ul className="space-y-2">
          {group.members.map((member) => (
            <li key={member.id} className="flex items-center gap-3">
              <Avatar name={member.name} url={member.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-gray-950">
                  {member.name}
                  {member.isSelf ? <span className="ms-1.5 font-semibold text-gray-400">({t.you})</span> : null}
                </p>
                <p className="text-xs font-semibold text-gray-500">{member.role === "ADMIN" ? t.admin : t.member}</p>
              </div>
              {isAdmin && !member.isSelf ? (
                <div className="flex shrink-0 gap-1.5">
                  <form action={updateGroupMemberRoleAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="targetUserId" value={member.userId} />
                    <input type="hidden" name="role" value={member.role === "ADMIN" ? "MEMBER" : "ADMIN"} />
                    <button
                      type="submit"
                      title={member.role === "ADMIN" ? t.removeAdmin : t.makeAdmin}
                      className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-brand-teal hover:text-brand-teal"
                    >
                      {member.role === "ADMIN" ? <ShieldOff className="size-4" aria-hidden="true" /> : <Shield className="size-4" aria-hidden="true" />}
                      <span className="sr-only">{member.role === "ADMIN" ? t.removeAdmin : t.makeAdmin}</span>
                    </button>
                  </form>
                  <form action={removeGroupMemberAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="targetUserId" value={member.userId} />
                    <button
                      type="submit"
                      title={t.remove}
                      className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-red-600 transition hover:border-red-300 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      <span className="sr-only">{t.remove}</span>
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <form action={leaveGroupAction} className="mt-4 border-t border-gray-100 pt-3">
          <input type="hidden" name="groupId" value={group.id} />
          <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-black text-red-600 hover:underline">
            <LogOut className="size-4" aria-hidden="true" />
            {t.leave}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-gray-500">{t.feedTitle}</h2>
        {feed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-50 text-brand-teal">
              <Users className="size-6" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-gray-500">{t.feedEmpty}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {feed.map((run) => (
              <li key={run.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={run.authorName} url={run.authorAvatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-gray-950">{run.authorName}</p>
                    <p className="truncate text-xs font-semibold text-gray-500">{formatDate(run.startedAt, locale)}</p>
                  </div>
                </div>
                {run.title ? <p className="mt-3 text-sm font-bold text-gray-800">{run.title}</p> : null}
                <div className="mt-3 flex items-center gap-4">
                  <p className="text-lg font-black tabular-nums text-gray-950">
                    {run.distanceKm.toFixed(1)} <span className="text-xs font-bold text-gray-500">{t.km}</span>
                  </p>
                  <p className="text-lg font-black tabular-nums text-brand-teal">{formatPace(run.averagePaceSecondsPerKm)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
