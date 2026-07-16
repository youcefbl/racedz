"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CoachLocale } from "@/components/coach/types";
import { loadCueDensity, saveCueDensity } from "@/lib/native/audio-prefs";
import { isVoiceAvailable, primeCues, speakCue, type CueDensity } from "@/lib/native/cues";
import { cn } from "@/lib/utils";

// Audio-coaching settings (audio plan, Phase D): one three-level choice over how chatty the
// guided-run voice is, plus a test button so the runner hears the voice before heading out.
// If the device has no voice for the app language (e.g. Arabic TTS data not installed), a hint
// explains why cues will be tones-only — playback itself already degrades silently.

type SettingsCopy = {
  title: string;
  full: string;
  essential: string;
  tones: string;
  test: string;
  sample: string;
  voiceMissing: string;
};

const COPY: Record<CoachLocale, SettingsCopy> = {
  en: {
    title: "Voice guidance",
    full: "Full",
    essential: "Essential",
    tones: "Tones only",
    test: "Test voice",
    sample: "Hello! This is your running coach. Have a great session.",
    voiceMissing: "No voice found for this language on your device. Install Google Text-to-Speech language data to enable spoken cues — tones and vibrations still work."
  },
  fr: {
    title: "Guidage vocal",
    full: "Complet",
    essential: "Essentiel",
    tones: "Sons seulement",
    test: "Tester la voix",
    sample: "Bonjour ! Je suis votre coach de course. Bonne séance.",
    voiceMissing: "Aucune voix trouvée pour cette langue sur votre appareil. Installez les données vocales Google Text-to-Speech pour activer les annonces — les sons et vibrations fonctionnent quand même."
  },
  ar: {
    title: "التوجيه الصوتي",
    full: "كامل",
    essential: "أساسي",
    tones: "نغمات فقط",
    test: "جرّب الصوت",
    sample: "مرحبًا! أنا مدرب الجري الخاص بك. حصة موفقة.",
    voiceMissing: "لا يوجد صوت لهذه اللغة على جهازك. ثبّت بيانات اللغة في Google Text-to-Speech لتفعيل الإرشادات الصوتية — تبقى النغمات والاهتزازات تعمل."
  }
};

const OPTIONS: Array<{ value: CueDensity; key: "full" | "essential" | "tones" }> = [
  { value: "full", key: "full" },
  { value: "essential", key: "essential" },
  { value: "tones", key: "tones" }
];

export function AudioSettings({ locale }: { locale: CoachLocale }) {
  const copy = COPY[locale];
  const [density, setDensity] = useState<CueDensity | null>(null); // null while loading
  const [voiceOk, setVoiceOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadCueDensity().then((value) => {
      if (!cancelled) setDensity(value);
    });
    void isVoiceAvailable(locale).then((ok) => {
      if (!cancelled) setVoiceOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const choose = (value: CueDensity) => {
    setDensity(value);
    void saveCueDensity(value);
  };

  const testVoice = () => {
    primeCues();
    speakCue(copy.sample, locale, "essential");
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-500">
          <Volume2 className="size-4 text-brand-teal" aria-hidden="true" />
          {copy.title}
        </h3>
        {density !== "tones" ? (
          <button
            type="button"
            onClick={testVoice}
            className="inline-flex min-h-8 items-center rounded-md px-1.5 text-xs font-black text-brand-teal transition hover:text-brand-tealDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            {copy.test}
          </button>
        ) : null}
      </div>

      <div role="radiogroup" aria-label={copy.title} className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={density === option.value}
            onClick={() => choose(option.value)}
            disabled={density === null}
            className={cn(
              "min-h-9 rounded-md px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
              density === option.value ? "bg-white text-gray-950 shadow-sm" : "text-gray-600 hover:text-gray-950"
            )}
          >
            {copy[option.key]}
          </button>
        ))}
      </div>

      {!voiceOk && density !== "tones" ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">{copy.voiceMissing}</p>
      ) : null}
    </section>
  );
}
