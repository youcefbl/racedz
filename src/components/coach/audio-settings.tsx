"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CoachLocale } from "@/components/coach/types";
import { loadAudioPrefs, saveCueDensity, saveWarmupGuidance } from "@/lib/native/audio-prefs";
import { isVoiceAvailable, openVoiceInstall, playVoiceSample, primeCues, type CueDensity } from "@/lib/native/cues";
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
  testing: string;
  testPassed: string;
  testFailed: string;
  installVoice: string;
  sample: string;
  voiceMissing: string;
  warmupToggle: string;
  warmupHint: string;
};

const COPY: Record<CoachLocale, SettingsCopy> = {
  en: {
    title: "Voice guidance",
    full: "Full",
    essential: "Essential",
    tones: "Tones only",
    test: "Test voice",
    testing: "Playing…",
    testPassed: "Voice played successfully.",
    testFailed: "Voice couldn't play. Check your connection and media volume.",
    installVoice: "Install voice data",
    sample: "Hello! This is your running coach. Have a great session.",
    voiceMissing: "Your device doesn't have voice data installed for this language, so cues stream online instead (uses a small amount of data). Install the on-device voice to keep it fully offline.",
    warmupToggle: "Warm-up & cool-down tips",
    warmupHint: "Spoken reminders to start gently and to ease off at the end."
  },
  fr: {
    title: "Guidage vocal",
    full: "Complet",
    essential: "Essentiel",
    tones: "Sons seulement",
    test: "Tester la voix",
    testing: "Lecture…",
    testPassed: "La voix a été lue correctement.",
    testFailed: "Impossible de lire la voix. Vérifiez votre connexion et le volume multimédia.",
    installVoice: "Installer les données vocales",
    sample: "Bonjour ! Je suis votre coach de course. Bonne séance.",
    voiceMissing: "Votre appareil n'a pas de données vocales installées pour cette langue, les annonces sont donc diffusées en ligne (utilise un peu de données). Installez la voix locale pour rester hors ligne.",
    warmupToggle: "Conseils échauffement & retour au calme",
    warmupHint: "Rappels vocaux pour démarrer en douceur et relâcher en fin de séance."
  },
  ar: {
    title: "التوجيه الصوتي",
    full: "كامل",
    essential: "أساسي",
    tones: "نغمات فقط",
    test: "جرّب الصوت",
    testing: "جارٍ التشغيل…",
    testPassed: "تم تشغيل الصوت بنجاح.",
    testFailed: "تعذّر تشغيل الصوت. تحقّق من اتصالك بالإنترنت ومستوى صوت الوسائط.",
    installVoice: "تثبيت بيانات الصوت",
    sample: "مرحبًا! أنا مدرب الجري الخاص بك. حصة موفقة.",
    voiceMissing: "جهازك لا يحتوي على بيانات صوتية لهذه اللغة، لذا يتم بث الإرشادات الصوتية عبر الإنترنت (يستهلك قدرًا صغيرًا من البيانات). ثبّت الصوت المحلي للبقاء بدون اتصال بالكامل.",
    warmupToggle: "نصائح الإحماء والتهدئة",
    warmupHint: "تذكيرات صوتية للبدء بهدوء والتخفيف في نهاية الحصة."
  }
};

const OPTIONS: Array<{ value: CueDensity; key: "full" | "essential" | "tones" }> = [
  { value: "full", key: "full" },
  { value: "essential", key: "essential" },
  { value: "tones", key: "tones" }
];

export function AudioSettings({ locale, embedded = false }: { locale: CoachLocale; embedded?: boolean }) {
  const copy = COPY[locale];
  const [density, setDensity] = useState<CueDensity | null>(null); // null while loading
  const [warmup, setWarmup] = useState(true);
  const [voiceOk, setVoiceOk] = useState(true);
  const [testState, setTestState] = useState<"idle" | "playing" | "success" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    void loadAudioPrefs().then((prefs) => {
      if (cancelled) return;
      setDensity(prefs.density);
      setWarmup(prefs.warmupGuidance);
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

  const toggleWarmup = (enabled: boolean) => {
    setWarmup(enabled);
    void saveWarmupGuidance(enabled);
  };

  const testVoice = async () => {
    if (testState === "playing") return;
    primeCues();
    setTestState("playing");
    const result = await playVoiceSample(copy.sample, locale);
    setVoiceOk(result.code !== "unavailable");
    setTestState(result.ok ? "success" : "error");
  };

  return (
    <section className={cn(embedded ? "border-t border-gray-200 pt-4" : "rounded-xl border border-gray-200 bg-white p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-gray-500">
          <Volume2 className="size-4 text-brand-teal" aria-hidden="true" />
          {copy.title}
        </h3>
        {density !== "tones" ? (
          <button
            type="button"
            onClick={() => void testVoice()}
            disabled={testState === "playing"}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-black text-brand-teal transition hover:bg-teal-50 hover:text-brand-tealDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:cursor-wait disabled:opacity-60"
          >
            {testState === "playing" ? <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {testState === "playing" ? copy.testing : copy.test}
          </button>
        ) : null}
      </div>

      <div aria-live="polite">
        {testState === "success" ? (
          <p className="mt-3 flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> {copy.testPassed}
          </p>
        ) : null}
        {testState === "error" ? (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {copy.testFailed}
          </p>
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
              "min-h-11 rounded-md px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
              density === option.value ? "bg-white text-gray-950 shadow-sm" : "text-gray-600 hover:text-gray-950"
            )}
          >
            {copy[option.key]}
          </button>
        ))}
      </div>

      {/* Warm-up/cool-down tips are "full guidance" commentary — the toggle only matters there. */}
      {density === "full" ? (
        <label className="mt-3 flex items-start gap-3 rounded-md border border-gray-200 p-3 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={warmup}
            onChange={(event) => toggleWarmup(event.target.checked)}
            className="mt-0.5 size-4 accent-brand-teal"
          />
          <span>
            {copy.warmupToggle}
            <span className="mt-0.5 block text-xs font-medium text-gray-500">{copy.warmupHint}</span>
          </span>
        </label>
      ) : null}

      {!voiceOk && density !== "tones" ? (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
          <p>{copy.voiceMissing}</p>
          <button type="button" onClick={() => void openVoiceInstall()} className="mt-1.5 min-h-11 font-black underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">
            {copy.installVoice}
          </button>
        </div>
      ) : null}
    </section>
  );
}
