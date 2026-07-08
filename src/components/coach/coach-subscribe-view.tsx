"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Sparkles, Wallet } from "lucide-react";
import { submitCoachSubscriptionAction, type SubscribeState } from "@/app/account/coach/subscribe/actions";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDate } from "@/components/coach/format";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import type { CoachEntitlement, CoachLocale } from "@/components/coach/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RequestView = {
  id: string;
  plan: string;
  amountDa: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  paymentProofUrl: string;
};

export type SubscriptionView = {
  id: string;
  plan: string;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  months: number;
  amountDa: number | null;
  startedAt: string;
  expiresAt: string;
  cancelledAt: string | null;
};

type PlanView = { id: "MONTHLY" | "YEARLY"; months: number; priceDa: number };
type PaymentDetails = { baridiMobNumber: string | null; ccpAccount: string | null; ccpKey: string | null; note: string | null };

const initialState: SubscribeState = {};

export function CoachSubscribeView({
  locale,
  copy,
  entitlement,
  pendingRequest,
  lastRequest,
  subscriptions,
  plans,
  payment
}: {
  locale: CoachLocale;
  copy: CoachCopy;
  entitlement: CoachEntitlement;
  pendingRequest: RequestView | null;
  lastRequest: RequestView | null;
  subscriptions: SubscriptionView[];
  plans: PlanView[];
  payment: PaymentDetails;
}) {
  const [state, formAction, pending] = useActionState(submitCoachSubscriptionAction, initialState);
  const [selectedPlan, setSelectedPlan] = useState<PlanView["id"]>(plans[0]?.id ?? "MONTHLY");
  const hasAccess = entitlement.tier === "SUBSCRIBED" || entitlement.tier === "TRIAL";
  const hasPaymentDetails = Boolean(payment.baridiMobNumber || payment.ccpAccount);
  // Under review once submitted (this render) or if a pending request already exists.
  const underReview = state.success || Boolean(pendingRequest);
  const wasDeclined = !pendingRequest && lastRequest?.status === "REJECTED";
  const fmtDate = (iso: string) => formatCoachDate(iso, locale, { year: "numeric", month: "short", day: "numeric" });
  const planLabel = (id: string) => (id === "YEARLY" ? copy.planYearly : id === "MONTHLY" ? copy.planMonthly : id);

  return (
    <div className="min-h-[70vh] bg-gray-50" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">{copy.subscribeTitle}</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-600">{copy.subscribeIntro}</p>
        </header>

        {/* Current access status */}
        <StatusBanner entitlement={entitlement} copy={copy} fmtDate={fmtDate} />

        {hasAccess ? (
          <a
            href="/account/coach"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand-teal transition hover:underline"
          >
            <ArrowLeft className={cn("size-4", locale === "ar" && "rotate-180")} aria-hidden="true" />
            {copy.backToCoach}
          </a>
        ) : null}

        {/* Submitted / under review */}
        {underReview ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-blue-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-blue-800">{copy.requestUnderReview}</p>
              {pendingRequest ? (
                <p className="mt-1 text-xs font-semibold text-blue-700">
                  {planLabel(pendingRequest.plan)}
                  {pendingRequest.amountDa != null ? ` · ${pendingRequest.amountDa} ${copy.currencyDa}` : ""} ·{" "}
                  {fmtDate(pendingRequest.createdAt)}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <SubscribeForm
            copy={copy}
            plans={plans}
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
            payment={payment}
            hasPaymentDetails={hasPaymentDetails}
            wasDeclined={wasDeclined}
            declineNote={lastRequest?.reviewNote ?? null}
            formAction={formAction}
            pending={pending}
            error={state.error}
            planLabel={planLabel}
          />
        )}

        {/* History */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-black text-gray-950">{copy.subHistoryTitle}</h2>
          {subscriptions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-8 text-center text-sm font-semibold text-gray-600">
              {copy.subHistoryEmpty}
            </p>
          ) : (
            <ul className="space-y-2">
              {subscriptions.map((sub) => (
                <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-gray-950">{planLabel(sub.plan)}</p>
                      <SubscriptionBadge status={sub.status} copy={copy} />
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500 tabular-nums">
                      {copy.subStartsLabel} {fmtDate(sub.startedAt)} · {copy.subEndsLabel} {fmtDate(sub.expiresAt)}
                    </p>
                  </div>
                  {sub.amountDa != null ? (
                    <p className="text-sm font-black tabular-nums text-gray-950">
                      {sub.amountDa} {copy.currencyDa}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusBanner({
  entitlement,
  copy,
  fmtDate
}: {
  entitlement: CoachEntitlement;
  copy: CoachCopy;
  fmtDate: (iso: string) => string;
}) {
  if (entitlement.tier === "SUBSCRIBED") {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle2 className="size-5 shrink-0 text-green-600" aria-hidden="true" />
        <p className="text-sm font-bold text-green-800">
          {copy.statusSubscribed}
          {entitlement.subscriptionEndsAt ? ` · ${copy.statusSubscribedUntil.replace("{date}", fmtDate(entitlement.subscriptionEndsAt))}` : ""}
        </p>
      </div>
    );
  }
  if (entitlement.tier === "TRIAL") {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Sparkles className="size-5 shrink-0 text-blue-600" aria-hidden="true" />
        <p className="text-sm font-bold text-blue-800">
          {copy.statusTrial}
          {entitlement.trialEndsAt ? ` · ${copy.statusTrialEndsOn.replace("{date}", fmtDate(entitlement.trialEndsAt))}` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <AlertCircle className="size-5 shrink-0 text-red-600" aria-hidden="true" />
      <p className="text-sm font-bold text-red-800">{copy.statusTrialEnded} {copy.statusBlocked}</p>
    </div>
  );
}

function SubscribeForm({
  copy,
  plans,
  selectedPlan,
  onSelectPlan,
  payment,
  hasPaymentDetails,
  wasDeclined,
  declineNote,
  formAction,
  pending,
  error,
  planLabel
}: {
  copy: CoachCopy;
  plans: PlanView[];
  selectedPlan: PlanView["id"];
  onSelectPlan: (id: PlanView["id"]) => void;
  payment: PaymentDetails;
  hasPaymentDetails: boolean;
  wasDeclined: boolean;
  declineNote: string | null;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  planLabel: (id: string) => string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {wasDeclined ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {copy.requestDeclined}
            {declineNote ? ` — ${declineNote}` : ""}
          </span>
        </p>
      ) : null}

      {/* Plan picker */}
      <p className="mb-2 text-sm font-black text-gray-950">{copy.choosePlan}</p>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelectPlan(plan.id)}
            aria-pressed={selectedPlan === plan.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border p-4 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal",
              selectedPlan === plan.id ? "border-brand-teal bg-teal-50" : "border-gray-200 bg-white hover:border-brand-teal"
            )}
          >
            <span>
              <span className="block font-black text-gray-950">{planLabel(plan.id)}</span>
              <span className="block text-xs font-semibold text-gray-500">
                {plan.months} {copy.planMonthsSuffix}
              </span>
            </span>
            <span className="text-lg font-black tabular-nums text-brand-teal">
              {plan.priceDa} {copy.currencyDa}
            </span>
          </button>
        ))}
      </div>

      {/* Where to pay */}
      <div className="mb-5 rounded-lg border border-orange-200 bg-orange-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-orange">
          <Wallet className="size-4" aria-hidden="true" />
          {copy.payHowTitle}
        </p>
        <div className="mt-2 space-y-1 text-sm text-gray-700">
          {hasPaymentDetails ? (
            <>
              {payment.baridiMobNumber ? (
                <p>
                  <span className="font-semibold">{copy.payBaridi}:</span> {payment.baridiMobNumber}
                </p>
              ) : null}
              {payment.ccpAccount ? (
                <p>
                  <span className="font-semibold">{copy.payCcp}:</span> {payment.ccpAccount}
                  {payment.ccpKey ? ` · ${copy.payCcpKey} ${payment.ccpKey}` : ""}
                </p>
              ) : null}
              {payment.note ? <p className="text-gray-600">{payment.note}</p> : null}
            </>
          ) : (
            <p className="text-gray-600">{copy.payNoDetails}</p>
          )}
        </div>
      </div>

      {/* Proof + submit */}
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="plan" value={selectedPlan} />
        {error ? (
          <p role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <label className="grid gap-1.5 text-sm font-bold text-gray-800">
          {copy.methodQuestion}
          <select
            name="paymentMethod"
            defaultValue="BARIDIMOB"
            className="min-h-11 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
          >
            <option value="BARIDIMOB">{copy.methodBaridi}</option>
            <option value="CCP">{copy.methodCcp}</option>
          </select>
        </label>
        <ImageUploadField label={copy.proofFieldLabel} name="paymentProofUrl" scope="coach-payment" helpText={copy.proofFieldHelp} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? copy.submittingRequest : copy.submitRequest}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SubscriptionBadge({ status, copy }: { status: SubscriptionView["status"]; copy: CoachCopy }) {
  const map = {
    ACTIVE: { label: copy.subStatusActive, className: "bg-green-100 text-green-700" },
    EXPIRED: { label: copy.subStatusExpired, className: "bg-gray-100 text-gray-600" },
    CANCELLED: { label: copy.subStatusCancelled, className: "bg-gray-100 text-gray-600" }
  }[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase", map.className)}>{map.label}</span>;
}
