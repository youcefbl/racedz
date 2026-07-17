"use client";

import { Minus, Play, Plus, Route as RouteIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { CoachLocale } from "@/components/coach/types";
import {
  buildGuidedSession,
  clamp,
  estimateStructureDistanceKm,
  summarizeStructure,
  GUIDED_SESSION_TEMPLATES,
  type GuidedSessionTemplate,
  type WorkoutStructure
} from "@/lib/coach/workout-structure";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Guided session library (audio plan, Phase C): the runner picks a session type directly — no
// plan required — adjusts a parameter or two, and starts a voice-guided run. The coach's planned
// workout (when there is one) stays the headline offer above this; the library serves "I want to
// train X today" and the free runner.

type PickerCopy = {
  title: string;
  subtitle: string;
  start: string;
  estimate: string;
  names: Record<GuidedSessionTemplate["id"], string>;
  taglines: Record<GuidedSessionTemplate["id"], string>;
  params: Record<string, string>;
};

const COPY: Record<CoachLocale, PickerCopy> = {
  en: {
    title: "Guided sessions",
    subtitle: "Pick a session — your coach guides you by voice while you run.",
    start: "Start session",
    estimate: "approx.",
    names: {
      intervals: "Intervals",
      norwegian: "Norwegian threshold",
      strides: "Easy run + strides",
      recovery: "Recovery run",
      long_run: "Long run"
    },
    taglines: {
      intervals: "Hard reps, jog recovery — splits spoken every rep.",
      norwegian: "Controlled 4×4 — the voice keeps you from going too hard.",
      strides: "Relaxed run finished with short, light pickups.",
      recovery: "Truly easy — the coach only ever says “slow down”.",
      long_run: "Steady distance with splits, hydration and milestones."
    },
    params: {
      reps: "Reps",
      repMeters: "Rep distance (m)",
      workMinutes: "Work (min)",
      easyMinutes: "Easy run (min)",
      durationMin: "Duration (min)",
      distanceKm: "Distance (km)"
    }
  },
  fr: {
    title: "Séances guidées",
    subtitle: "Choisissez une séance — votre coach vous guide à la voix pendant la course.",
    start: "Démarrer la séance",
    estimate: "environ",
    names: {
      intervals: "Fractionné",
      norwegian: "Seuil norvégien",
      strides: "Footing + lignes droites",
      recovery: "Récupération",
      long_run: "Sortie longue"
    },
    taglines: {
      intervals: "Fractions rapides, récupération en trottinant — temps annoncés à chaque rep.",
      norwegian: "4×4 contrôlé — la voix vous empêche d'aller trop vite.",
      strides: "Footing tranquille terminé par de courtes accélérations légères.",
      recovery: "Vraiment facile — le coach ne dit que « ralentissez ».",
      long_run: "Distance régulière avec temps au km, hydratation et jalons."
    },
    params: {
      reps: "Répétitions",
      repMeters: "Distance par rep (m)",
      workMinutes: "Effort (min)",
      easyMinutes: "Footing (min)",
      durationMin: "Durée (min)",
      distanceKm: "Distance (km)"
    }
  },
  ar: {
    title: "حصص موجَّهة",
    subtitle: "اختر حصة — يرشدك المدرب صوتيًا أثناء الجري.",
    start: "ابدأ الحصة",
    estimate: "تقريبًا",
    names: {
      intervals: "تكرارات سرعة",
      norwegian: "عتبة نرويجية",
      strides: "جري خفيف + تسارعات",
      recovery: "جري استشفائي",
      long_run: "جري طويل"
    },
    taglines: {
      intervals: "تكرارات قوية مع استشفاء خفيف — يُعلن وقت كل تكرار.",
      norwegian: "4×4 منضبط — الصوت يمنعك من الاندفاع الزائد.",
      strides: "جري مريح يُختم بتسارعات قصيرة وخفيفة.",
      recovery: "سهل حقًا — المدرب لا يقول سوى «خفف السرعة».",
      long_run: "مسافة ثابتة مع أوقات الكيلومترات والترطيب والمحطات."
    },
    params: {
      reps: "التكرارات",
      repMeters: "مسافة التكرار (م)",
      workMinutes: "الجهد (دقيقة)",
      easyMinutes: "الجري الخفيف (دقيقة)",
      durationMin: "المدة (دقيقة)",
      distanceKm: "المسافة (كم)"
    }
  }
};

function defaultsFor(template: GuidedSessionTemplate): Record<string, number> {
  return Object.fromEntries(template.params.map((param) => [param.key, param.default]));
}

export function GuidedSessionPicker({
  locale,
  onStart
}: {
  locale: CoachLocale;
  onStart: (session: { workoutType: string; structure: WorkoutStructure; templateId: string }) => void;
}) {
  const copy = COPY[locale];
  const [selectedId, setSelectedId] = useState<GuidedSessionTemplate["id"] | null>(null);
  const [params, setParams] = useState<Record<string, number>>({});

  const selected = GUIDED_SESSION_TEMPLATES.find((template) => template.id === selectedId) ?? null;
  const structure = useMemo(() => (selected ? buildGuidedSession(selected, params) : null), [selected, params]);

  const select = (template: GuidedSessionTemplate) => {
    if (selectedId === template.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(template.id);
    setParams(defaultsFor(template));
  };

  const adjust = (key: string, delta: number) => {
    if (!selected) return;
    const spec = selected.params.find((param) => param.key === key);
    if (!spec) return;
    setParams((current) => {
      const next = (current[key] ?? spec.default) + delta * spec.step;
      return { ...current, [key]: clamp(next, spec.min, spec.max) };
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-xs font-black uppercase tracking-wide text-gray-500">{copy.title}</h3>
      <p className="mt-1 text-xs font-semibold text-gray-500">{copy.subtitle}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {GUIDED_SESSION_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => select(template)}
            aria-pressed={selectedId === template.id}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
              selectedId === template.id
                ? "border-brand-teal bg-teal-50 text-brand-teal"
                : "border-gray-300 bg-white text-gray-700 hover:border-brand-teal hover:text-brand-teal"
            )}
          >
            {copy.names[template.id]}
          </button>
        ))}
      </div>

      {selected && structure ? (
        <div className="mt-4 rounded-lg bg-gray-50 p-3">
          <p className="text-sm font-black text-gray-950">{copy.names[selected.id]}</p>
          <p className="mt-0.5 text-xs leading-5 text-gray-600">{copy.taglines[selected.id]}</p>

          <div className="mt-3 grid gap-3">
            {selected.params.map((param) => (
              <div key={param.key} className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-gray-700">{copy.params[param.key] ?? param.key}</span>
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjust(param.key, -1)}
                    disabled={(params[param.key] ?? param.default) <= param.min}
                    aria-label={`${copy.params[param.key] ?? param.key} −`}
                    className="flex size-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-40"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-12 text-center text-sm font-black tabular-nums text-gray-950">
                    {params[param.key] ?? param.default}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjust(param.key, 1)}
                    disabled={(params[param.key] ?? param.default) >= param.max}
                    aria-label={`${copy.params[param.key] ?? param.key} +`}
                    className="flex size-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-40"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-gray-600">
            <RouteIcon className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
            {summarizeStructure(structure, locale)}
            <span className="font-semibold text-gray-500">
              · {copy.estimate} {estimateStructureDistanceKm(structure)} km
            </span>
          </p>

          <Button
            type="button"
            size="lg"
            className="mt-3 w-full"
            onClick={() => onStart({ workoutType: selected.workoutType, structure, templateId: selected.id })}
          >
            <Play className="size-5" aria-hidden="true" /> {copy.start}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
