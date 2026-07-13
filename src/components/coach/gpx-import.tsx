"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { CoachLocale } from "@/components/coach/types";
import { cn } from "@/lib/utils";

const copy = {
  en: { title: "Import a run", hint: "Add a run recorded on a watch or another app (.gpx).", choose: "Choose GPX file", effort: "Perceived effort (1–10)", makePublic: "Share publicly", importBtn: "Import run", importing: "Importing…", cancel: "Cancel", success: "Run imported." },
  fr: { title: "Importer une course", hint: "Ajoutez une course enregistrée sur une montre ou une autre app (.gpx).", choose: "Choisir un fichier GPX", effort: "Effort perçu (1–10)", makePublic: "Partager publiquement", importBtn: "Importer", importing: "Importation…", cancel: "Annuler", success: "Course importée." },
  ar: { title: "استيراد جري", hint: "أضف جريًا مسجَّلًا على ساعة أو تطبيق آخر (.gpx).", choose: "اختر ملف GPX", effort: "الجهد المُدرَك (1–10)", makePublic: "مشاركة علنية", importBtn: "استيراد", importing: "جارٍ الاستيراد…", cancel: "إلغاء", success: "تم استيراد الجري." }
} as const;

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
        setError(json?.error ?? "Import failed.");
        return;
      }
      reset();
      onImported();
    } catch {
      setError("Import failed.");
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
      <p className="mb-3 text-xs font-semibold text-gray-500">{t.hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError(null);
        }}
        className="block w-full text-sm text-gray-600 file:me-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-black file:text-brand-teal hover:file:bg-teal-100"
      />

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
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
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
