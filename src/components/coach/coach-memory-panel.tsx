"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  Download,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  UserCog
} from "lucide-react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import type { CoachLocale } from "@/components/coach/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MemoryItem = {
  id: string;
  kind: string;
  fact: string;
  source: string;
  ageDays: number;
  agingOut: boolean;
};

// The runner's trust surface for long-term coaching memory (Phase 3): see every durable fact the
// coach keeps between conversations, where it came from, and remove or reconfirm any of it. The
// source is the signal that matters — a fact the runner stated reads as trusted, one the coach only
// inferred reads as a guess to check — so it drives the badge styling rather than being decoration.

// Each source maps to a distinct, theme-safe chip. Confidence in what the runner said; a softer,
// neutral read for what the coach guessed, so it's obvious which facts to correct.
const SOURCE_STYLE: Record<string, { icon: typeof User; className: string; labelKey: keyof CoachCopy["memory"]["source"] }> = {
  RUNNER_STATED: { icon: User, className: "bg-teal-50 text-teal-700 border-teal-100", labelKey: "stated" },
  HUMAN_COACH: { icon: UserCog, className: "bg-blue-50 text-blue-700 border-blue-100", labelKey: "humanCoach" },
  SYSTEM_DERIVED: { icon: TrendingUp, className: "bg-green-50 text-green-700 border-green-100", labelKey: "derived" },
  AI_INFERRED: { icon: Sparkles, className: "bg-gray-100 text-gray-700 border-gray-200", labelKey: "inferred" }
};

const KIND_LABEL: Record<string, keyof CoachCopy["memory"]["kind"]> = {
  PREFERENCE: "preference",
  COACHING_TONE: "coachingTone",
  SCHEDULE: "schedule",
  TERRAIN: "terrain",
  CONSTRAINT: "constraint",
  COMMITMENT: "commitment",
  STRATEGY_WORKED: "strategyWorked",
  STRATEGY_FAILED: "strategyFailed",
  REJECTED_SUGGESTION: "rejectedSuggestion",
  COACH_NOTE: "coachNote"
};

export function CoachMemoryPanel({ locale, copy, onBack }: { locale: CoachLocale; copy: CoachCopy; onBack: () => void }) {
  const t = copy.memory;
  const isRtl = locale === "ar";
  const [items, setItems] = useState<MemoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Per-row action in flight, so only the touched row shows a spinner and disables.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await coachRequest<{ data: MemoryItem[] }>("/api/coach/memory");
      setItems(payload.data);
    } catch {
      setError(t.loadFailed);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const forget = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      setNotice(null);
      try {
        await coachRequest("/api/coach/memory", { method: "PATCH", body: JSON.stringify({ id, action: "dismiss" }) });
        setItems((current) => current?.filter((item) => item.id !== id) ?? current);
      } catch {
        setError(t.actionFailed);
      } finally {
        setBusyId(null);
      }
    },
    [t.actionFailed]
  );

  const confirmStillTrue = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      setNotice(null);
      try {
        await coachRequest("/api/coach/memory", { method: "PATCH", body: JSON.stringify({ id, action: "confirm" }) });
        // Reconfirming resets the staleness clock, so the row is no longer aging out.
        setItems((current) => current?.map((item) => (item.id === id ? { ...item, ageDays: 0, agingOut: false } : item)) ?? current);
      } catch {
        setError(t.actionFailed);
      } finally {
        setBusyId(null);
      }
    },
    [t.actionFailed]
  );

  const exportAll = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const payload = await coachRequest<{ data: unknown }>("/api/coach/memory?scope=export");
      const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `zidrun-coach-memory-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.actionFailed);
    } finally {
      setExporting(false);
    }
  }, [t.actionFailed]);

  const deleteAll = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await coachRequest("/api/coach/memory", { method: "DELETE" });
      setItems([]);
      setConfirmingDelete(false);
      setNotice(t.deleted);
    } catch {
      setError(t.actionFailed);
    } finally {
      setDeleting(false);
    }
  }, [t.actionFailed, t.deleted]);

  const ageLabel = (ageDays: number) => (ageDays <= 0 ? t.ageToday : t.ageDaysAgo.replace("{n}", String(ageDays)));

  return (
    <section dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gray-600 transition hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        {isRtl ? <ArrowRight className="size-4" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
        {t.back}
      </button>

      <div className="mt-2 flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-white">
          <BrainCircuit className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-black text-balance text-gray-950 sm:text-2xl">{t.title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">{t.intro}</p>
        </div>
      </div>

      {/* The trust anchor: this feature deliberately does not store health data. Say so plainly. */}
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs font-semibold leading-5 text-gray-600">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden="true" />
        {t.healthNote}
      </p>

      {error ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-700">
          <Check className="size-4 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      ) : null}

      <div className="mt-5">
        {items === null ? (
          <MemorySkeleton />
        ) : items.length === 0 ? (
          <EmptyState title={t.emptyTitle} text={t.emptyText} />
        ) : (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
              {t.countLabel.replace("{n}", String(items.length))}
            </p>
            <ul className="space-y-2.5">
              {items.map((item) => {
                const source = SOURCE_STYLE[item.source] ?? SOURCE_STYLE.AI_INFERRED;
                const SourceIcon = source.icon;
                const kindKey = KIND_LABEL[item.kind];
                const busy = busyId === item.id;
                return (
                  <li
                    key={item.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold", source.className)}>
                        <SourceIcon className="size-3" aria-hidden="true" />
                        {t.source[source.labelKey]}
                      </span>
                      {kindKey ? (
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{t.kind[kindKey]}</span>
                      ) : null}
                      <span className="text-xs font-semibold text-gray-500 ms-auto">{ageLabel(item.ageDays)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-gray-950">{item.fact}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.agingOut ? (
                        <button
                          type="button"
                          onClick={() => confirmStillTrue(item.id)}
                          disabled={busy}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-700 transition hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50 [@media(pointer:coarse)]:min-h-11"
                        >
                          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
                          {busy ? t.confirming : t.confirm}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => forget(item.id)}
                        disabled={busy}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-gray-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50 [@media(pointer:coarse)]:min-h-11"
                      >
                        {busy && !item.agingOut ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        )}
                        {busy && !item.agingOut ? t.forgetting : t.forget}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Bulk data controls: only meaningful once something is stored. */}
      {items && items.length > 0 ? (
        <div className="mt-6 border-t border-gray-200 pt-5">
          {confirmingDelete ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-black text-red-800">{t.deleteTitle}</p>
              <p className="mt-1 text-sm leading-6 text-red-700">{t.deleteText}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" size="sm" onClick={deleteAll} disabled={deleting}>
                  {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                  {deleting ? t.deleting : t.deleteConfirm}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                  {t.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={exportAll}
                disabled={exporting}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-50"
              >
                {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                {exporting ? t.exporting : t.export}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t.deleteAll}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
        <BrainCircuit className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-black text-gray-950">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-gray-600">{text}</p>
    </div>
  );
}

function MemorySkeleton() {
  return (
    <ul className="space-y-2.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-5 w-28 animate-pulse rounded-full bg-gray-100" />
            <span className="h-4 w-16 animate-pulse rounded bg-gray-100" />
          </div>
          <span className="mt-3 block h-4 w-3/4 animate-pulse rounded bg-gray-100" />
          <span className="mt-2 block h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}
