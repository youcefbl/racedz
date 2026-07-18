"use client";

import { Droplet, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useCallback, useState } from "react";
import type { NutritionDay } from "@/lib/coach/nutrition";
import type { CoachLocale } from "@/components/coach/types";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;

const copy = {
  en: {
    title: "Fuel & hydration",
    intro: "Log meals and water so your coach can factor fueling into your training.",
    today: "Today",
    calories: "Calories",
    water: "Water",
    addWater: "Add water",
    addMeal: "Add meal",
    description: "What did you eat?",
    optionalKcal: "kcal (optional)",
    add: "Add",
    empty: "Nothing logged yet today.",
    meals: { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACK: "Snack" } as Record<string, string>,
    kcal: "kcal"
  },
  fr: {
    title: "Nutrition & hydratation",
    intro: "Notez repas et eau pour que votre coach intègre l'alimentation à votre entraînement.",
    today: "Aujourd'hui",
    calories: "Calories",
    water: "Eau",
    addWater: "Ajouter de l'eau",
    addMeal: "Ajouter un repas",
    description: "Qu'avez-vous mangé ?",
    optionalKcal: "kcal (optionnel)",
    add: "Ajouter",
    empty: "Rien de noté aujourd'hui.",
    meals: { BREAKFAST: "Petit-déjeuner", LUNCH: "Déjeuner", DINNER: "Dîner", SNACK: "Collation" } as Record<string, string>,
    kcal: "kcal"
  },
  ar: {
    title: "التغذية والترطيب",
    intro: "سجّل الوجبات والماء ليأخذ مدربك التغذية في الحسبان.",
    today: "اليوم",
    calories: "السعرات",
    water: "الماء",
    addWater: "أضف ماءً",
    addMeal: "أضف وجبة",
    description: "ماذا أكلت؟",
    optionalKcal: "سعرة (اختياري)",
    add: "أضف",
    empty: "لا شيء مُسجَّل اليوم.",
    meals: { BREAKFAST: "فطور", LUNCH: "غداء", DINNER: "عشاء", SNACK: "وجبة خفيفة" } as Record<string, string>,
    kcal: "سعرة"
  }
} as const;

function formatWater(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${ml} ml`;
}

function todayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatDay(iso: string, locale: CoachLocale): string {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar" : locale, { weekday: "short", month: "short", day: "numeric" });
}

export function NutritionView({ initialDays, locale }: { initialDays: NutritionDay[]; locale: CoachLocale }) {
  const t = copy[locale];
  const rtl = locale === "ar";
  const [days, setDays] = useState<NutritionDay[]>(initialDays);
  const [mealType, setMealType] = useState<string>("SNACK");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/coach/nutrition", { headers: { accept: "application/json" } });
    const json = (await res.json().catch(() => null)) as { data?: NutritionDay[] } | null;
    if (json?.data) setDays(json.data);
  }, []);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch("/api/coach/nutrition", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        if (res.ok) await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const addWater = (ml: number) => void post({ kind: "HYDRATION", waterMl: ml });

  const addMeal = () => {
    if (!description.trim() && !calories) return;
    void post({
      kind: "MEAL",
      mealType,
      description: description.trim() || null,
      calories: calories ? Number(calories) : null
    }).then(() => {
      setDescription("");
      setCalories("");
    });
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/coach/nutrition/${id}`, { method: "DELETE" });
      if (res.ok) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const tIso = todayIso();
  const today = days.find((d) => d.date === tIso) ?? { date: tIso, entries: [], totalCalories: 0, totalWaterMl: 0 };
  const earlier = days.filter((d) => d.date !== tIso);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="mb-4">
        <h1 className="text-2xl font-black text-gray-950">{t.title}</h1>
        <p className="text-sm font-semibold text-gray-500">{t.intro}</p>
      </div>

      {/* Today's totals */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <UtensilsCrossed className="mb-1 size-5 text-brand-orange" aria-hidden="true" />
          <p className="text-2xl font-black tabular-nums text-gray-950">{today.totalCalories}</p>
          <p className="text-xs font-bold text-orange-800">{t.calories} · {t.kcal}</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
          <Droplet className="mb-1 size-5 text-brand-teal" aria-hidden="true" />
          <p className="text-2xl font-black tabular-nums text-gray-950">{formatWater(today.totalWaterMl)}</p>
          <p className="text-xs font-bold text-teal-800">{t.water}</p>
        </div>
      </div>

      {/* Quick add water */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-black text-gray-950">{t.addWater}</p>
        <div className="flex gap-2">
          {[250, 500, 750].map((ml) => (
            <button
              key={ml}
              type="button"
              disabled={busy}
              onClick={() => addWater(ml)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 text-sm font-black text-brand-teal transition hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60"
            >
              <Droplet className="size-4" aria-hidden="true" />+{ml >= 1000 ? `${ml / 1000}L` : `${ml}`}
            </button>
          ))}
        </div>
      </div>

      {/* Add meal */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-black text-gray-950">{t.addMeal}</p>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMealType(m)}
                aria-pressed={mealType === m}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${mealType === m ? "bg-brand-orange text-[#18001c]" : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}
              >
                {t.meals[m]}
              </button>
            ))}
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.description}
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
          />
          <div className="flex gap-2">
            <input
              value={calories}
              onChange={(e) => setCalories(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder={t.optionalKcal}
              className="h-11 w-36 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              disabled={busy || (!description.trim() && !calories)}
              onClick={addMeal}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-teal px-4 text-sm font-black text-white transition hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t.add}
            </button>
          </div>
        </div>
      </div>

      {/* Today's entries */}
      <DayCard day={today} label={t.today} locale={locale} onDelete={remove} busy={busy} emptyText={t.empty} mealLabels={t.meals} kcal={t.kcal} />

      {earlier.map((day) => (
        <DayCard key={day.date} day={day} label={formatDay(day.date, locale)} locale={locale} onDelete={remove} busy={busy} emptyText={t.empty} mealLabels={t.meals} kcal={t.kcal} />
      ))}
    </div>
  );
}

function DayCard({
  day,
  label,
  onDelete,
  busy,
  emptyText,
  mealLabels,
  kcal
}: {
  day: NutritionDay;
  label: string;
  locale: CoachLocale;
  onDelete: (id: string) => void;
  busy: boolean;
  emptyText: string;
  mealLabels: Record<string, string>;
  kcal: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-black text-gray-950">{label}</p>
        <p className="text-xs font-bold text-gray-500 tabular-nums">
          {day.totalCalories} {kcal} · {formatWater(day.totalWaterMl)}
        </p>
      </div>
      {day.entries.length === 0 ? (
        <p className="py-3 text-center text-sm font-semibold text-gray-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {day.entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 py-2">
              {entry.kind === "HYDRATION" ? (
                <Droplet className="size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              ) : (
                <UtensilsCrossed className="size-4 shrink-0 text-brand-orange" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800">
                {entry.kind === "HYDRATION"
                  ? formatWater(entry.waterMl ?? 0)
                  : `${entry.mealType ? `${mealLabels[entry.mealType]}: ` : ""}${entry.description ?? ""}`}
              </span>
              {entry.kind === "MEAL" && entry.calories ? (
                <span className="shrink-0 text-xs font-black tabular-nums text-gray-500">
                  {entry.calories} {kcal}
                </span>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(entry.id)}
                aria-label="Delete"
                className="shrink-0 rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
