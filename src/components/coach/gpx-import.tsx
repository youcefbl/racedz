"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { CoachLocale } from "@/components/coach/types";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    title: "Import a run",
    hint: "Add a run recorded on a watch or another app (.gpx).",
    choose: "Choose GPX file",
    effort: "Perceived effort (1–10)",
    makePublic: "Share publicly",
    importBtn: "Import run",
    importing: "Importing…",
    cancel: "Cancel",
    invalidFile: "Choose a file whose name ends in .gpx.",
    fileTooLarge: "This GPX file is larger than 5 MB.",
    importFailed: "Import failed. Check your connection and try again."
  },
  fr: {
    title: "Importer une sortie",
    hint: "Ajoutez une sortie enregistrée sur une montre ou une autre application (.gpx).",
    choose: "Choisir un fichier GPX",
    effort: "Effort perçu (1–10)",
    makePublic: "Partager publiquement",
    importBtn: "Importer",
    importing: "Importation…",
    cancel: "Annuler",
    invalidFile: "Choisissez un fichier dont le nom se termine par .gpx.",
    fileTooLarge: "Ce fichier GPX dépasse 5 Mo.",
    importFailed: "L'importation a échoué. Vérifiez votre connexion et réessayez."
  },
  ar: {
    title: "استيراد جري",
    hint: "أضف جريًا مسجَّلًا على ساعة أو تطبيق آخر (.gpx).",
    choose: "اختر ملف GPX",
    effort: "الجهد المُدرَك (1–10)",
    makePublic: "مشاركة علنية",
    importBtn: "استيراد",
    importing: "جارٍ الاستيراد…",
    cancel: "إلغاء",
    invalidFile: "اختر ملفًا ينتهي اسمه بـ .gpx.",
    fileTooLarge: "حجم ملف GPX هذا أكبر من 5 ميغابايت.",
    importFailed: "فشل الاستيراد. تحقق من الاتصال وحاول مرة أخرى."
  }
} as const;

const MAX_GPX_FILE_BYTES = 5 * 1024 * 1024;

export function GpxImport({ locale, onImported }: { locale: CoachLocale; onImported: () => void }) {
  const t = copy[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [effort, setEffort] = useState(5);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setEffort(5);
    setIsPublic(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("perceivedEffort", String(effort));
      body.append("isPublic", String(isPublic));
      const res = await fetch("/api/coach/runs/import", { method: "POST", body });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(json?.error ?? t.importFailed);
        return;
      }
      reset();
      onImported();
    } catch {
      setError(t.importFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Upload className="size-5 text-brand-teal" aria-hidden="true" />
        <h2 className="text-base font-black text-gray-950">{t.title}</h2>
      </div>
      <p id="gpx-import-hint" className="mb-3 text-xs font-semibold text-gray-500">
        {t.hint}
      </p>

      <label className="sr-only" htmlFor="gpx-import-file">
        {t.choose}
      </label>
      <input
        id="gpx-import-file"
        ref={inputRef}
        type="file"
        // Deliberately omit `accept`. Android combines the listed MIME types into a restrictive
        // document-provider filter, and Drive commonly labels GPX files as octet-stream. Omitting
        // it keeps local and cloud files selectable; the extension check below gives immediate
        // feedback and the server still validates the actual XML/GPX content.
        aria-describedby="gpx-import-hint"
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null;
          setError(null);
          if (!selected) {
            setFile(null);
            return;
          }
          if (!selected.name.toLowerCase().endsWith(".gpx")) {
            setFile(null);
            setError(t.invalidFile);
            e.currentTarget.value = "";
            return;
          }
          if (selected.size > MAX_GPX_FILE_BYTES) {
            setFile(null);
            setError(t.fileTooLarge);
            e.currentTarget.value = "";
            return;
          }
          setFile(selected);
        }}
        className="block w-full text-sm text-gray-600 file:me-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-black file:text-brand-teal hover:file:bg-teal-100"
      />

      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {file ? (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <label className="grid gap-1 text-xs font-bold text-gray-700">
            {t.effort}
            <select
              value={effort}
              onChange={(e) => setEffort(Number(e.target.value))}
              className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="size-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal" />
            {t.makePublic}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-teal px-4 text-sm font-black text-white transition hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60"
              )}
            >
              <Upload className="size-4" aria-hidden="true" />
              {busy ? t.importing : t.importBtn}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-600 transition hover:border-gray-300 disabled:opacity-60"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
