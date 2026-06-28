"use client";

import {
  Activity,
  CalendarDays,
  Check,
  HeartPulse,
  Languages,
  Route,
  ShieldCheck,
  Target
} from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { coachRequest } from "@/components/coach/api";
import {
  chronicConditionOptions,
  goalOptions,
  localizedOption,
  type CoachCopy
} from "@/components/coach/copy";
import type { CoachLocale } from "@/components/coach/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CoachGoalFormProps = {
  locale: CoachLocale;
  copy: CoachCopy;
  onCreated: () => Promise<void>;
};

const experienceValues = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const TOTAL_STEPS = 5;

export function CoachGoalForm({ locale, copy, onCreated }: CoachGoalFormProps) {
  const [step, setStep] = useState(0);

  // Step 1 — goal
  const [goalType, setGoalType] = useState("TEN_K");
  const [customGoal, setCustomGoal] = useState("");
  const [targetDate, setTargetDate] = useState(futureDate(84));
  const [targetDistanceKm, setTargetDistanceKm] = useState("");
  const [targetTime, setTargetTime] = useState("");

  // Step 2 — background
  const [experience, setExperience] = useState<(typeof experienceValues)[number]>("BEGINNER");
  const [yearsRunning, setYearsRunning] = useState("");
  const [currentWeeklyDistanceKm, setCurrentWeeklyDistanceKm] = useState("10");
  const [peakWeeklyDistanceKm, setPeakWeeklyDistanceKm] = useState("");
  const [longestRecentRunKm, setLongestRecentRunKm] = useState("");
  const [recentRaceResult, setRecentRaceResult] = useState("");
  const [restingHeartRate, setRestingHeartRate] = useState("");
  const [weightKg, setWeightKg] = useState("");

  // Step 3 — availability
  const [trainingDays, setTrainingDays] = useState<number[]>([2, 4, 6]);
  const [preferredLongRunDay, setPreferredLongRunDay] = useState("6");
  const [constraints, setConstraints] = useState("");

  // Step 4 — health
  const [injuryNotes, setInjuryNotes] = useState("");
  const [injuryHistory, setInjuryHistory] = useState("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [healthNotes, setHealthNotes] = useState("");

  // Step 5 — review
  const [preferredLocale, setPreferredLocale] = useState<CoachLocale>(locale);
  const [consent, setConsent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Move focus to the validation message so keyboard/SR users notice why a step blocked.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const stepLabels = [
    copy.stepGoalLabel,
    copy.stepBackgroundLabel,
    copy.stepAvailabilityLabel,
    copy.stepHealthLabel,
    copy.stepReviewLabel
  ];

  function toggleTrainingDay(index: number) {
    setTrainingDays((current) => {
      const next = current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index].sort((a, b) => a - b);
      if (!next.includes(Number(preferredLongRunDay))) setPreferredLongRunDay("");
      return next;
    });
  }

  function toggleCondition(value: string) {
    setChronicConditions((current) => {
      if (value === "NONE") return [];
      const without = current.filter((item) => item !== "NONE");
      return without.includes(value) ? without.filter((item) => item !== value) : [...without, value];
    });
  }

  function validateStep(current: number): string | null {
    const required = (field: string) => copy.requiredField.replace("{field}", field);
    if (current === 0) {
      if (goalType === "OTHER" && customGoal.trim().length < 3) return required(copy.goalType);
      if (!targetDate) return required(copy.targetDate);
    }
    if (current === 1) {
      if (currentWeeklyDistanceKm.trim() === "" || Number(currentWeeklyDistanceKm) < 0) return required(copy.weeklyDistance);
    }
    if (current === 2) {
      if (trainingDays.length < 2) return copy.minTrainingDays;
    }
    if (current === 4) {
      if (!consent) return copy.consentRequired;
    }
    return null;
  }

  function goNext() {
    const stepError = validateStep(step);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(0, current - 1));
  }

  function submit() {
    const stepError = validateStep(4);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await coachRequest("/api/coach/goals", {
          method: "POST",
          body: JSON.stringify({
            goalType,
            customGoal: goalType === "OTHER" ? customGoal.trim() || null : null,
            targetDate,
            targetDistanceKm: numberOrNull(targetDistanceKm),
            targetTimeSeconds: targetTime.trim() ? parseDurationToSeconds(targetTime.trim()) : null,
            experienceLevel: experience,
            currentWeeklyDistanceKm: Number(currentWeeklyDistanceKm) || 0,
            yearsRunning: numberOrNull(yearsRunning),
            peakWeeklyDistanceKm: numberOrNull(peakWeeklyDistanceKm),
            longestRecentRunKm: numberOrNull(longestRecentRunKm),
            recentRaceResult: recentRaceResult.trim() || null,
            restingHeartRate: numberOrNull(restingHeartRate),
            weightKg: numberOrNull(weightKg),
            availableTrainingDays: trainingDays,
            preferredLongRunDay: preferredLongRunDay ? Number(preferredLongRunDay) : null,
            constraints: constraints.trim() || null,
            injuryNotes: injuryNotes.trim() || null,
            injuryHistory: injuryHistory.trim() || null,
            chronicConditions,
            healthNotes: healthNotes.trim() || null,
            preferredLocale
          })
        });
        await onCreated();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : copy.goalCreateFailed);
      }
    });
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mb-6 max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-teal-50 px-3 py-1.5 text-xs font-black uppercase text-brand-teal">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {copy.eyebrow}
        </div>
        <h1 className="text-3xl font-black text-gray-950 sm:text-4xl">{copy.setupTitle}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">{copy.setupText}</p>
      </div>

      <Stepper labels={stepLabels} current={step} copy={copy} />

      <div className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-5 sm:p-7">
          {step === 0 ? (
            <StepShell icon={Target} title={copy.goalStepTitle}>
              <Field label={copy.goalType}>
                <select value={goalType} onChange={(event) => setGoalType(event.target.value)} className={inputClass}>
                  {goalOptions.map((option) => (
                    <option key={option[0]} value={option[0]}>{localizedOption(option, locale)}</option>
                  ))}
                </select>
              </Field>
              {goalType === "OTHER" ? (
                <Field label={copy.goalType}>
                  <input value={customGoal} onChange={(event) => setCustomGoal(event.target.value)} maxLength={300} className={inputClass} />
                </Field>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.targetDate}>
                  <input type="date" min={tomorrow()} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={inputClass} />
                </Field>
                <Field label={copy.targetDistance} hint={copy.optional}>
                  <input type="number" min="0.1" max="500" step="0.1" value={targetDistanceKm} onChange={(event) => setTargetDistanceKm(event.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label={copy.targetTime} hint={copy.optional}>
                <input inputMode="numeric" placeholder="00:50:00" pattern="[0-9]{1,2}:[0-5][0-9]:[0-5][0-9]" value={targetTime} onChange={(event) => setTargetTime(event.target.value)} className={inputClass} />
              </Field>
            </StepShell>
          ) : null}

          {step === 1 ? (
            <StepShell icon={Route} title={copy.backgroundStepTitle} text={copy.backgroundStepText}>
              <FieldGroup label={copy.experience}>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={copy.experience}>
                  {experienceValues.map((value, index) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={experience === value}
                      onClick={() => setExperience(value)}
                      className={cn(
                        "min-h-11 rounded-md border px-2 text-xs font-black transition sm:text-sm",
                        experience === value
                          ? "border-brand-teal bg-teal-50 text-brand-teal"
                          : "border-gray-200 bg-white text-gray-600 hover:border-brand-teal"
                      )}
                    >
                      {[copy.beginner, copy.intermediate, copy.advanced][index]}
                    </button>
                  ))}
                </div>
              </FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.yearsRunning} hint={copy.optional}>
                  <input type="number" min="0" max="80" step="1" value={yearsRunning} onChange={(event) => setYearsRunning(event.target.value)} className={inputClass} />
                </Field>
                <Field label={copy.weeklyDistance}>
                  <input type="number" min="0" max="500" step="0.1" value={currentWeeklyDistanceKm} onChange={(event) => setCurrentWeeklyDistanceKm(event.target.value)} className={inputClass} />
                </Field>
                <Field label={copy.peakWeeklyDistance} hint={copy.optional}>
                  <input type="number" min="0" max="500" step="0.1" value={peakWeeklyDistanceKm} onChange={(event) => setPeakWeeklyDistanceKm(event.target.value)} className={inputClass} />
                </Field>
                <Field label={copy.longestRecentRun} hint={copy.optional}>
                  <input type="number" min="0" max="500" step="0.1" value={longestRecentRunKm} onChange={(event) => setLongestRecentRunKm(event.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label={copy.recentRaceResult} hint={copy.optional}>
                <input placeholder={copy.recentRaceResultHint} maxLength={300} value={recentRaceResult} onChange={(event) => setRecentRaceResult(event.target.value)} className={inputClass} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.restingHeartRate} hint={copy.optional}>
                  <input type="number" min="30" max="120" step="1" value={restingHeartRate} onChange={(event) => setRestingHeartRate(event.target.value)} className={inputClass} />
                </Field>
                <Field label={copy.weight} hint={copy.weightHint}>
                  <input type="number" min="20" max="300" step="0.1" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} className={inputClass} />
                </Field>
              </div>
            </StepShell>
          ) : null}

          {step === 2 ? (
            <StepShell icon={CalendarDays} title={copy.availabilityStepTitle}>
              <FieldGroup label={copy.trainingDays} role="group">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {copy.days.map((day, index) => {
                    const selected = trainingDays.includes(index);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTrainingDay(index)}
                        className={cn(
                          "flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-black transition",
                          selected ? "border-brand-teal bg-teal-50 text-brand-teal" : "border-gray-200 text-gray-600 hover:border-brand-teal"
                        )}
                      >
                        {selected ? <Check className="size-3" aria-hidden="true" /> : null}
                        {day}
                      </button>
                    );
                  })}
                </div>
              </FieldGroup>
              <Field label={copy.longRunDay} hint={copy.optional}>
                <select value={preferredLongRunDay} onChange={(event) => setPreferredLongRunDay(event.target.value)} className={inputClass}>
                  <option value="">-</option>
                  {trainingDays.map((day) => <option key={day} value={day}>{copy.dayNames[day]}</option>)}
                </select>
              </Field>
              <Field label={copy.constraints} hint={copy.optional}>
                <textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} maxLength={1000} rows={3} className={inputClass} />
              </Field>
            </StepShell>
          ) : null}

          {step === 3 ? (
            <StepShell icon={HeartPulse} title={copy.healthStepTitle} text={copy.healthStepText}>
              <Field label={copy.currentInjury} hint={copy.optional}>
                <textarea value={injuryNotes} onChange={(event) => setInjuryNotes(event.target.value)} maxLength={1000} rows={2} className={inputClass} />
              </Field>
              <Field label={copy.injuryHistory} hint={copy.injuryHistoryHint}>
                <textarea value={injuryHistory} onChange={(event) => setInjuryHistory(event.target.value)} maxLength={1000} rows={2} className={inputClass} />
              </Field>
              <FieldGroup label={copy.chronicConditions} hint={copy.chronicHint} role="group">
                <div className="flex flex-wrap gap-2">
                  {chronicConditionOptions.map((option) => {
                    const value = option[0];
                    const selected = value === "NONE" ? chronicConditions.length === 0 : chronicConditions.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleCondition(value)}
                        className={cn(
                          "min-h-11 rounded-full border px-4 text-xs font-black transition",
                          selected ? "border-brand-teal bg-teal-50 text-brand-teal" : "border-gray-200 text-gray-600 hover:border-brand-teal"
                        )}
                      >
                        {localizedOption(option, locale)}
                      </button>
                    );
                  })}
                </div>
              </FieldGroup>
              <Field label={copy.healthNotes} hint={copy.optional}>
                <textarea value={healthNotes} onChange={(event) => setHealthNotes(event.target.value)} maxLength={1000} rows={2} className={inputClass} />
              </Field>
            </StepShell>
          ) : null}

          {step === 4 ? (
            <StepShell icon={Languages} title={copy.reviewStepTitle}>
              <dl className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
                <SummaryRow label={copy.goalType} value={localizedOption(goalOptions.find((option) => option[0] === goalType) ?? goalOptions[0], locale)} />
                <SummaryRow label={copy.targetDate} value={targetDate} />
                <SummaryRow label={copy.experience} value={[copy.beginner, copy.intermediate, copy.advanced][experienceValues.indexOf(experience)]} />
                <SummaryRow label={copy.weeklyDistance} value={`${currentWeeklyDistanceKm || 0} km`} />
                <SummaryRow label={copy.trainingDays} value={trainingDays.map((day) => copy.days[day]).join(", ")} />
                <SummaryRow
                  label={copy.chronicConditions}
                  value={chronicConditions.length === 0
                    ? localizedOption(chronicConditionOptions[0], locale)
                    : chronicConditions
                        .map((value) => localizedOption(chronicConditionOptions.find((option) => option[0] === value) ?? chronicConditionOptions[0], locale))
                        .join(", ")}
                />
              </dl>
              <Field label={copy.responseLanguage}>
                <select value={preferredLocale} onChange={(event) => setPreferredLocale(event.target.value as CoachLocale)} className={inputClass}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </Field>
              <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 text-sm text-gray-700">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4 accent-brand-teal" />
                <span>{copy.consentLabel}</span>
              </label>
            </StepShell>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs leading-5 text-gray-500">{copy.formDisclaimer}</p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm font-semibold text-red-700 outline-none">{error}</p> : null}
            <div className="flex gap-3">
              {step > 0 ? (
                <Button type="button" variant="outline" size="lg" onClick={goBack} disabled={pending}>
                  {copy.back}
                </Button>
              ) : null}
              {step < TOTAL_STEPS - 1 ? (
                <Button type="button" size="lg" onClick={goNext}>
                  {copy.next}
                </Button>
              ) : (
                <Button type="button" size="lg" onClick={submit} disabled={pending || !consent}>
                  {pending ? copy.saving : copy.saveGoal}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stepper({ labels, current, copy }: { labels: string[]; current: number; copy: CoachCopy }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        {copy.stepWord} {current + 1} {copy.ofWord} {labels.length}
      </p>
      <ol className="flex flex-wrap gap-2">
        {labels.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-black transition",
                active
                  ? "border-brand-teal bg-teal-50 text-brand-teal"
                  : done
                    ? "border-brand-teal/40 bg-white text-brand-teal"
                    : "border-gray-200 bg-white text-gray-500"
              )}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px]", active || done ? "bg-brand-teal text-white" : "bg-gray-100 text-gray-500")}>
                {done ? <Check className="size-3" aria-hidden="true" /> : index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepShell({ icon: Icon, title, text, children }: { icon: typeof Target; title: string; text?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-brand-orange" aria-hidden="true" />
        <h2 className="text-lg font-black text-gray-950">{title}</h2>
      </div>
      {text ? <p className="text-sm leading-6 text-gray-600">{text}</p> : null}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-gray-800">
      <span className="flex items-center gap-2">
        {label}
        {hint ? <span className="text-xs font-medium text-gray-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

// Like Field, but for groups of controls (toggle buttons, radio grids) where a
// single <label> would be invalid. Exposes an accessible group name when `role` is set.
function FieldGroup({
  label,
  hint,
  role,
  children
}: {
  label: string;
  hint?: string;
  role?: "group";
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 text-sm font-bold text-gray-800" role={role} aria-label={role ? label : undefined}>
      <span className="flex items-center gap-2">
        {label}
        {hint ? <span className="text-xs font-medium text-gray-500">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
        <Activity className="size-3.5 text-brand-teal" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-900">{value || "-"}</dd>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20";

function numberOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function parseDurationToSeconds(value: string) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function tomorrow() {
  return futureDate(1);
}

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
