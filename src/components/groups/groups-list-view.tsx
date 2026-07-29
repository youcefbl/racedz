"use client";

import { Users, Copy, Check, Lock, Globe, Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createGroupAction, joinPublicGroupAction, type GroupFormState } from "@/app/account/groups/actions";
import type { CoachLocale } from "@/components/coach/types";
import type { GroupSummary } from "@/lib/groups";
import { withLocale } from "@/lib/i18n";

const copy = {
  en: {
    title: "Groups",
    intro: "Private (or public) run-clubs — members see each other's runs, whether or not those runs are otherwise public.",
    create: "Create group",
    cancel: "Cancel",
    name: "Group name",
    namePlaceholder: "e.g. Algiers Sunday Runners",
    picture: "Group picture",
    privacy: "Privacy",
    private: "Private — invite only",
    public: "Public — anyone can find and join",
    members: "members",
    admin: "Admin",
    member: "Member",
    empty: "You're not in any group yet",
    emptyText: "Create one, or ask a friend for their group's invite link.",
    creating: "Creating…",
    createBtn: "Create",
    discoverTitle: "Discover public groups",
    join: "Join"
  },
  fr: {
    title: "Groupes",
    intro: "Des clubs de course privés (ou publics) — les membres voient les courses des autres, publiques ou non.",
    create: "Créer un groupe",
    cancel: "Annuler",
    name: "Nom du groupe",
    namePlaceholder: "ex. Coureurs du dimanche d'Alger",
    picture: "Photo du groupe",
    privacy: "Confidentialité",
    private: "Privé — sur invitation",
    public: "Public — visible et rejoignable par tous",
    members: "membres",
    admin: "Admin",
    member: "Membre",
    empty: "Vous n'êtes dans aucun groupe",
    emptyText: "Créez-en un, ou demandez le lien d'invitation d'un ami.",
    creating: "Création…",
    createBtn: "Créer",
    discoverTitle: "Découvrir des groupes publics",
    join: "Rejoindre"
  },
  ar: {
    title: "المجموعات",
    intro: "نوادي جري خاصة (أو عامة) — يرى الأعضاء جريات بعضهم البعض، سواء كانت علنية أم لا.",
    create: "إنشاء مجموعة",
    cancel: "إلغاء",
    name: "اسم المجموعة",
    namePlaceholder: "مثال: عدّاؤو الجزائر يوم الأحد",
    picture: "صورة المجموعة",
    privacy: "الخصوصية",
    private: "خاصة — بالدعوة فقط",
    public: "عامة — يمكن للجميع إيجادها والانضمام إليها",
    members: "أعضاء",
    admin: "مشرف",
    member: "عضو",
    empty: "لست في أي مجموعة بعد",
    emptyText: "أنشئ واحدة، أو اطلب رابط دعوة من صديق.",
    creating: "جارٍ الإنشاء…",
    createBtn: "إنشاء",
    discoverTitle: "اكتشف مجموعات عامة",
    join: "انضمام"
  }
} as const;

function GroupAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={48} height={48} loading="lazy" decoding="async" className="size-12 shrink-0 rounded-xl object-cover" />;
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-black text-brand-teal">
      {initials || "G"}
    </span>
  );
}

const initialState: GroupFormState = {};

function CreateGroupForm({ locale, onDone }: { locale: CoachLocale; onDone: () => void }) {
  const t = copy[locale];
  const [state, formAction, pending] = useActionState(createGroupAction, initialState);

  return (
    <form action={formAction} className="mb-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="lang" value={locale} />
      <label className="grid gap-1.5 text-xs font-bold text-gray-700">
        {t.name}
        <input
          type="text"
          name="name"
          required
          minLength={2}
          maxLength={60}
          placeholder={t.namePlaceholder}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-950 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <ImageUploadField label={t.picture} name="pictureUrl" scope="group" />

      <fieldset className="grid gap-2 text-xs font-bold text-gray-700">
        <legend className="mb-1">{t.privacy}</legend>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm font-semibold text-gray-700">
          <input type="radio" name="isPrivate" value="on" defaultChecked className="size-4 accent-brand-teal" />
          <Lock className="size-4 text-gray-500" aria-hidden="true" />
          {t.private}
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm font-semibold text-gray-700">
          <input type="radio" name="isPrivate" value="" className="size-4 accent-brand-teal" />
          <Globe className="size-4 text-gray-500" aria-hidden="true" />
          {t.public}
        </label>
      </fieldset>

      {state.error ? <p className="text-sm font-semibold text-red-700" role="alert">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? t.creating : t.createBtn}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

function GroupRow({ group, locale }: { group: GroupSummary; locale: CoachLocale }) {
  const t = copy[locale];
  return (
    <Link
      href={withLocale(`/account/groups/${group.id}`, locale)}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-teal"
    >
      <GroupAvatar name={group.name} url={group.pictureUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-950">{group.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          {group.isPrivate ? <Lock className="size-3.5" aria-hidden="true" /> : <Globe className="size-3.5" aria-hidden="true" />}
          {group.memberCount} {t.members}
        </p>
      </div>
      <Badge variant={group.role === "ADMIN" ? "teal" : "default"} className="shrink-0">
        {group.role === "ADMIN" ? t.admin : t.member}
      </Badge>
    </Link>
  );
}

function DiscoverGroupRow({ group, locale }: { group: GroupSummary; locale: CoachLocale }) {
  const t = copy[locale];
  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <GroupAvatar name={group.name} url={group.pictureUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-950">{group.name}</p>
        <p className="mt-0.5 text-xs font-semibold text-gray-500">
          {group.memberCount} {t.members}
        </p>
      </div>
      <form action={joinPublicGroupAction}>
        <input type="hidden" name="groupId" value={group.id} />
        <Button type="submit" size="sm" variant="outline">
          {t.join}
        </Button>
      </form>
    </li>
  );
}

export function GroupsListView({
  groups,
  discoverGroups,
  locale
}: {
  groups: GroupSummary[];
  discoverGroups: GroupSummary[];
  locale: CoachLocale;
}) {
  const t = copy[locale];
  const rtl = locale === "ar";
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950">{t.title}</h1>
          <p className="text-sm font-semibold text-gray-500">{t.intro}</p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? <X className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {t.create}
        </Button>
      </div>

      {creating ? <CreateGroupForm locale={locale} onDone={() => setCreating(false)} /> : null}

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-50 text-brand-teal">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-base font-black text-gray-950">{t.empty}</p>
          <p className="mt-1 text-sm font-semibold text-gray-500">{t.emptyText}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupRow group={group} locale={locale} />
            </li>
          ))}
        </ul>
      )}

      {discoverGroups.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-gray-500">{t.discoverTitle}</h2>
          <ul className="space-y-2">
            {discoverGroups.map((group) => (
              <DiscoverGroupRow key={group.id} group={group} locale={locale} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// Re-exported for the group detail page's copy-link control, kept here since both need the same
// small "copy to clipboard with a check-mark flash" affordance and it's not worth a new file.
export function CopyLinkButton({ url, locale }: { url: string; locale: CoachLocale }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const label = { en: "Copy link", fr: "Copier le lien", ar: "نسخ الرابط" }[locale];
  const copiedLabel = { en: "Copied!", fr: "Copié !", ar: "تم النسخ!" }[locale];

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => setCopied(true));
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 transition hover:border-brand-teal hover:text-brand-teal"
    >
      {copied ? <Check className="size-4 text-green-600" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
