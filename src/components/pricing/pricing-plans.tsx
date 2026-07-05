"use client";

import { ArrowRight, Check, GraduationCap, Sparkles } from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PricingPlansCopy = {
  monthly: string;
  yearly: string;
  perMonth: string;
  perYear: string;
  perMonthApprox: string; // "≈ {price} {currency}/mo"
  save: string; // "Save {percent}%"
  bestValue: string;
  coachTitle: string;
  coachSubtitle: string;
  trialBadge: string; // "7 days free"
  afterTrial: string; // "then {price}, cancel anytime"
  cta: string;
  features: string[];
  studentTitle: string;
  studentText: string; // "…use code {code}"
};

export function PricingPlans({
  monthly,
  yearly,
  currency,
  studentCode,
  ctaHref,
  copy,
  localeTag
}: {
  monthly: number;
  yearly: number;
  currency: string;
  studentCode: string;
  ctaHref: string;
  copy: PricingPlansCopy;
  localeTag: string;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");
  const nf = new Intl.NumberFormat(localeTag);
  const yearlyPerMonth = Math.round(yearly / 12);
  const savePercent = Math.round((1 - yearly / (monthly * 12)) * 100);
  const isYearly = cycle === "yearly";
  const price = isYearly ? yearly : monthly;
  const unit = isYearly ? copy.perYear : copy.perMonth;

  const fill = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

  return (
    <div className="mx-auto max-w-md">
      {/* Billing cycle toggle */}
      <div className="mx-auto mb-6 grid w-full max-w-xs grid-cols-2 gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCycle(option)}
            aria-pressed={cycle === option}
            className={cn(
              "relative min-h-11 rounded-full px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
              cycle === option ? "bg-brand-teal text-white shadow-sm" : "text-gray-600 hover:text-gray-950"
            )}
          >
            {option === "monthly" ? copy.monthly : copy.yearly}
            {option === "yearly" ? (
              <span
                className={cn(
                  "ms-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black",
                  cycle === "yearly" ? "bg-white/20 text-white" : "bg-orange-50 text-brand-orange"
                )}
              >
                −{savePercent}%
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Plan card */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-brand-teal bg-white p-6 shadow-soft sm:p-8">
        <span className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-black text-brand-teal">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {copy.bestValue}
        </span>

        <h3 className="text-lg font-black text-gray-950">{copy.coachTitle}</h3>
        <p className="mt-1 text-sm font-semibold text-gray-500">{copy.coachSubtitle}</p>

        <div className="mt-5 flex items-end gap-1.5">
          <span className="text-4xl font-black tabular-nums text-gray-950">{nf.format(price)}</span>
          <span className="pb-1 text-sm font-black text-gray-500">{currency}{unit}</span>
        </div>
        <p className="mt-1 min-h-5 text-sm font-bold text-brand-teal">
          {isYearly ? fill(copy.perMonthApprox, { price: nf.format(yearlyPerMonth), currency }) : " "}
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-black text-brand-orange">
          <Sparkles className="size-4" aria-hidden="true" />
          {copy.trialBadge}
        </div>

        <ButtonLink href={ctaHref} variant="primary" size="lg" className="mt-5 w-full justify-center">
          {copy.cta}
          <ArrowRight className="size-5 rtl:rotate-180" aria-hidden="true" />
        </ButtonLink>
        <p className="mt-3 text-center text-xs font-semibold text-gray-500">
          {fill(copy.afterTrial, { price: `${nf.format(price)} ${currency}${unit}` })}
        </p>

        <ul className="mt-6 space-y-3 border-t border-gray-200 pt-6">
          {copy.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm font-semibold text-gray-700">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-teal" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Student promo */}
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal">
          <GraduationCap className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-950">{copy.studentTitle}</p>
          <p className="mt-0.5 text-sm leading-6 text-gray-600">
            {copy.studentText.split("{code}")[0]}
            <span className="mx-1 inline-block rounded-md border border-dashed border-brand-teal bg-white px-1.5 py-0.5 font-mono text-xs font-black text-brand-teal">
              {studentCode}
            </span>
            {copy.studentText.split("{code}")[1]}
          </p>
        </div>
      </div>
    </div>
  );
}
