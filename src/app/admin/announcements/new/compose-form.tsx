"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Mail, MonitorSmartphone, Send, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { estimateAudienceAction, saveBroadcastDraftAction, sendBroadcastAction } from "../actions";

const ROLES = ["RUNNER", "ORGANIZER", "ADMIN", "SUPERADMIN"] as const;
const CHANNELS = [
  { key: "IN_APP", label: "In-app", icon: MonitorSmartphone },
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "PUSH", label: "Push", icon: Smartphone }
] as const;
const ACTIVE_OPTIONS = [
  { value: 0, label: "Any time" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" }
];

export function ComposeForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [href, setHref] = useState("");
  const [channels, setChannels] = useState<Record<string, boolean>>({ IN_APP: true, EMAIL: true, PUSH: true });

  const [roles, setRoles] = useState<Record<string, boolean>>({});
  const [wilaya, setWilaya] = useState("");
  const [city, setCity] = useState("");
  const [hasRegistration, setHasRegistration] = useState(false);
  const [hasCoachSubscription, setHasCoachSubscription] = useState(false);
  const [activeSinceDays, setActiveSinceDays] = useState(0);

  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [pending, startTransition] = useTransition();

  const audience = useMemo(() => {
    const selectedRoles = ROLES.filter((role) => roles[role]);
    return {
      roles: selectedRoles.length ? selectedRoles : undefined,
      wilaya: wilaya.trim() || undefined,
      city: city.trim() || undefined,
      hasRegistration: hasRegistration || undefined,
      hasCoachSubscription: hasCoachSubscription || undefined,
      activeSinceDays: activeSinceDays > 0 ? activeSinceDays : undefined
    };
  }, [roles, wilaya, city, hasRegistration, hasCoachSubscription, activeSinceDays]);

  // Debounced live recipient count as the segment changes.
  useEffect(() => {
    let cancelled = false;
    setEstimating(true);
    const timer = setTimeout(async () => {
      try {
        const count = await estimateAudienceAction(audience);
        if (!cancelled) setEstimate(count);
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audience]);

  const selectedChannels = CHANNELS.filter((c) => channels[c.key]).map((c) => c.key);

  function validate(): boolean {
    if (title.trim().length < 3) {
      toast("Give your announcement a title.", "error");
      return false;
    }
    if (body.trim().length < 3) {
      toast("Write a message body.", "error");
      return false;
    }
    if (selectedChannels.length === 0) {
      toast("Pick at least one channel.", "error");
      return false;
    }
    return true;
  }

  function payload() {
    return {
      title: title.trim(),
      body: body.trim(),
      href: href.trim() || undefined,
      channels: selectedChannels,
      audience
    };
  }

  function onSend() {
    if (!validate()) return;
    if (!window.confirm(`Send this to ~${estimate ?? "?"} recipients now?`)) return;
    startTransition(async () => {
      try {
        await sendBroadcastAction(payload());
      } catch {
        toast("Could not send the broadcast.", "error");
      }
    });
  }

  function onSaveDraft() {
    if (!validate()) return;
    startTransition(async () => {
      try {
        await saveBroadcastDraftAction(payload());
      } catch {
        toast("Could not save the draft.", "error");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Message */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-gray-950">Message</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="New 10K race in Oran 🏃"
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={6}
            placeholder="Registration is now open for the Oran 10K on March 14…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">Link (optional)</span>
          <input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            maxLength={500}
            placeholder="/races/oran-10k"
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
          <span className="mt-1 block text-xs text-gray-400">A path like /races/oran-10k or a full URL. Adds a button to the email.</span>
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">Channels</span>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((channel) => {
              const active = channels[channel.key];
              const Icon = channel.icon;
              return (
                <button
                  key={channel.key}
                  type="button"
                  onClick={() => setChannels((prev) => ({ ...prev, [channel.key]: !prev[channel.key] }))}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-colors",
                    active ? "border-brand-teal bg-teal-50 text-brand-teal" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {channel.label}
                </button>
              );
            })}
          </div>
          <span className="mt-1.5 block text-xs text-gray-400">Users who opted out of ZidRun announcements are skipped automatically.</span>
        </div>
      </div>

      {/* Audience + send */}
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-gray-950">Audience</h2>

          <div className="mt-3">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">Roles</span>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoles((prev) => ({ ...prev, [role]: !prev[role] }))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-bold transition-colors",
                    roles[role] ? "border-brand-teal bg-teal-50 text-brand-teal" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
            <span className="mt-1 block text-xs text-gray-400">Leave unselected for all roles.</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">Wilaya</span>
              <input
                value={wilaya}
                onChange={(e) => setWilaya(e.target.value)}
                placeholder="Any"
                className="h-9 w-full rounded-lg border border-gray-300 px-2.5 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">City</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Any"
                className="h-9 w-full rounded-lg border border-gray-300 px-2.5 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-400">Active</span>
            <select
              value={activeSinceDays}
              onChange={(e) => setActiveSinceDays(Number(e.target.value))}
              className="h-9 w-full rounded-lg border border-gray-300 px-2.5 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              {ACTIVE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={hasRegistration} onChange={(e) => setHasRegistration(e.target.checked)} className="size-4 accent-brand-teal" />
              Has registered for a race
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={hasCoachSubscription} onChange={(e) => setHasCoachSubscription(e.target.checked)} className="size-4 accent-brand-teal" />
              Has an active coach subscription
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-950">
                {estimating ? <Loader2 className="inline size-5 animate-spin text-gray-400" aria-hidden="true" /> : (estimate ?? "—")}
              </p>
              <p className="text-xs font-semibold text-gray-500">estimated recipients</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" onClick={onSend} disabled={pending || estimate === 0}>
              <Send className="size-4" aria-hidden="true" />
              {pending ? "Sending…" : "Send now"}
            </Button>
            <Button type="button" variant="outline" onClick={onSaveDraft} disabled={pending}>
              Save as draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
