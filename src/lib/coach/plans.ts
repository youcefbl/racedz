// Single source of truth for coach subscription pricing — used by the public pricing page and
// by admin subscription activation, so the number a runner sees is the number that gets billed.
// Prices are in Algerian dinar (DA). Payment is manual (CIB/Edahabia/CCP/BaridiMob), so there's
// no checkout here; admins record the plan + amount after receiving proof.

export const COACH_CURRENCY = "DA";

export type CoachPlanId = "MONTHLY" | "YEARLY" | "CUSTOM";

export const COACH_PLANS = {
  MONTHLY: { months: 1, priceDa: 790 },
  YEARLY: { months: 12, priceDa: 4900 }
} as const;

// The two plans a runner can request from the subscribe page, in display order. CUSTOM is
// admin-only (set at activation) so it isn't offered here.
export const COACH_REQUESTABLE_PLANS = [
  { id: "MONTHLY" as const, ...COACH_PLANS.MONTHLY },
  { id: "YEARLY" as const, ...COACH_PLANS.YEARLY }
];

// Where a runner sends manual payment for a coach subscription. Sourced from env so the platform's
// BaridiMob/CCP details aren't hard-coded; any field left unset is simply hidden on the page.
export function getCoachPaymentDetails() {
  const read = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };
  return {
    baridiMobNumber: read(process.env.COACH_PAYMENT_BARIDIMOB),
    ccpAccount: read(process.env.COACH_PAYMENT_CCP),
    ccpKey: read(process.env.COACH_PAYMENT_CCP_KEY),
    note: read(process.env.COACH_PAYMENT_NOTE)
  };
}

// Student discount, applied manually at activation (or shown on the pricing page as a promo).
export const STUDENT_PROMO = { code: "DZstudent", percentOff: 20 } as const;

export function studentPrice(priceDa: number): number {
  return Math.round(priceDa * (1 - STUDENT_PROMO.percentOff / 100));
}

// Resolve the charge (months + amount) for an activation. MONTHLY/YEARLY come from the config
// (optionally with the student discount); CUSTOM keeps whatever the admin typed.
export function resolvePlanCharge(
  plan: CoachPlanId,
  opts: { student?: boolean; monthsOverride?: number; amountOverride?: number | null } = {}
): { months: number; amountDa: number | null } {
  if (plan === "CUSTOM") {
    const months = Number.isFinite(opts.monthsOverride) && (opts.monthsOverride ?? 0) > 0 ? Math.trunc(opts.monthsOverride as number) : 1;
    return { months, amountDa: opts.amountOverride ?? null };
  }
  const base = COACH_PLANS[plan];
  return { months: base.months, amountDa: opts.student ? studentPrice(base.priceDa) : base.priceDa };
}
