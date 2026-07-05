"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "SCAM", label: "Scam or fake race" },
  { value: "INCORRECT_INFO", label: "Incorrect information" },
  { value: "OFFENSIVE", label: "Offensive content" },
  { value: "SPAM", label: "Spam" },
  { value: "OTHER", label: "Something else" }
] as const;

type ReportButtonProps = {
  targetType: "RaceEvent" | "RunnerRun" | "User";
  targetId: string;
  isAuthenticated: boolean;
  loginHref: string;
  className?: string;
};

// Lightweight "🚩 Report" control + dialog. Posts to /api/reports; unauthenticated
// users are sent to login instead of seeing the form.
export function ReportButton({ targetType, targetId, isAuthenticated, loginHref, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!category) {
      toast("Please pick a reason.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, category, details: details.trim() || undefined })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        toast("Thanks — our team will review this.", "success");
        setOpen(false);
        setCategory("");
        setDetails("");
      } else {
        toast(payload?.error ?? "Could not submit report.", "error");
      }
    } catch {
      toast("Could not submit report. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <a
        href={loginHref}
        className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700", className)}
      >
        <Flag className="size-3.5" aria-hidden="true" />
        Report
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700", className)}
      >
        <Flag className="size-3.5" aria-hidden="true" />
        Report
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report content"
          onClick={(event) => {
            if (event.target === event.currentTarget && !submitting) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-gray-950">Report this content</h2>
                <p className="mt-1 text-sm text-gray-500">Tell us what&apos;s wrong. Reports are reviewed by our team.</p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Reason</legend>
              {CATEGORIES.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                    category === option.value ? "border-brand-teal bg-teal-50 text-brand-teal" : "border-gray-200 text-gray-700 hover:border-gray-300"
                  )}
                >
                  <input
                    type="radio"
                    name="report-category"
                    value={option.value}
                    checked={category === option.value}
                    onChange={() => setCategory(option.value)}
                    className="size-4 accent-brand-teal"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Add any details (optional)"
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-teal-100"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
