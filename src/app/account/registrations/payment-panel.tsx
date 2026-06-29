"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { submitPaymentProofAction, type PaymentProofState } from "./actions";

export type PaymentLabels = {
  title: string;
  amount: string;
  payVia: string;
  baridiMob: string;
  ccp: string;
  ccpKey: string;
  note: string;
  noDetails: string;
  methodLabel: string;
  methodBaridiMob: string;
  methodCcp: string;
  proofLabel: string;
  proofHelp: string;
  submit: string;
  submitting: string;
  underReview: string;
  resubmit: string;
};

type RacePayment = {
  baridiMobNumber?: string | null;
  ccpAccount?: string | null;
  ccpKey?: string | null;
  paymentNote?: string | null;
};

const initialState: PaymentProofState = {};

export function PaymentPanel({
  registrationId,
  amount,
  race,
  underReview,
  labels
}: {
  registrationId: string;
  amount: string;
  race: RacePayment;
  underReview: boolean;
  labels: PaymentLabels;
}) {
  const [state, formAction, pending] = useActionState(submitPaymentProofAction, initialState);
  const hasDetails = Boolean(race.baridiMobNumber || race.ccpAccount);

  return (
    <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-brand-orangeText">
        <Wallet className="size-4" aria-hidden="true" />
        {labels.title} · {labels.amount}: {amount}
      </p>

      {/* Where to pay */}
      <div className="mt-3 space-y-1.5 text-sm text-gray-700">
        {hasDetails ? (
          <>
            <p className="font-semibold">{labels.payVia}:</p>
            {race.baridiMobNumber ? (
              <p>
                <span className="font-semibold">{labels.baridiMob}:</span> {race.baridiMobNumber}
              </p>
            ) : null}
            {race.ccpAccount ? (
              <p>
                <span className="font-semibold">{labels.ccp}:</span> {race.ccpAccount}
                {race.ccpKey ? ` · ${labels.ccpKey} ${race.ccpKey}` : ""}
              </p>
            ) : null}
            {race.paymentNote ? <p className="text-gray-600">{race.paymentNote}</p> : null}
          </>
        ) : (
          <p className="text-gray-600">{labels.noDetails}</p>
        )}
      </div>

      {underReview && !state.success ? (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-blue-50 p-2 text-sm font-semibold text-blue-700">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {labels.underReview}
        </p>
      ) : null}

      {state.success ? (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm font-semibold text-green-700">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {labels.underReview}
        </p>
      ) : (
        <form action={formAction} className="mt-4 grid gap-3">
          <input type="hidden" name="registrationId" value={registrationId} />
          {state.error ? (
            <p role="alert" className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-sm font-semibold text-red-700">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {state.error}
            </p>
          ) : null}
          <label className="grid gap-1.5 text-sm font-semibold text-gray-800">
            {labels.methodLabel}
            <select
              name="paymentMethod"
              defaultValue="BARIDIMOB"
              className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            >
              <option value="BARIDIMOB">{labels.methodBaridiMob}</option>
              <option value="CCP">{labels.methodCcp}</option>
            </select>
          </label>
          <ImageUploadField label={labels.proofLabel} name="paymentProofUrl" scope="payment" helpText={labels.proofHelp} />
          <Button type="submit" size="md" disabled={pending}>
            {pending ? labels.submitting : underReview ? labels.resubmit : labels.submit}
          </Button>
        </form>
      )}
    </div>
  );
}
