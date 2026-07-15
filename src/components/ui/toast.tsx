"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "success" | "info";
type ToastItem = { id: number; message: string; variant: ToastVariant };

// Tiny module-level pub/sub so any component can `toast(...)` without a provider.
let counter = 0;
let items: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  for (const listener of listeners) listener(items);
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

const TOAST_DURATION_MS = 4500;

// The auto-dismiss timer lives in each rendered row (see ToastRow), not here, so it can be
// paused while the user is hovering or keyboard-focused on the toast. Firing it from this
// module would make the toast disappear out from under someone mid-read.
export function toast(message: string, variant: ToastVariant = "info") {
  const id = (counter += 1);
  items = [...items, { id, message, variant }];
  emit();
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-700",
  info: "border-gray-200 bg-white text-gray-800"
};

const VARIANT_ICON = { error: AlertTriangle, success: CheckCircle2, info: Info } as const;

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setList);
    setList(items);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  // The container stays mounted even when empty: a live region that is inserted at the same
  // moment as its first message is announced unreliably by screen readers.
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] mx-auto flex max-w-sm flex-col gap-2 px-4"
      role="region"
      aria-label="Notifications"
    >
      {list.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToastRow({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  const Icon = VARIANT_ICON[item.variant];
  const isError = item.variant === "error";

  // Hold the toast open while it's hovered or focused, so it can't vanish mid-read or while
  // the user is tabbing to its dismiss button. Leaving restarts the full window rather than
  // resuming the remainder — after you look away you get the whole read time back.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => dismiss(item.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [paused, item.id]);

  return (
    <div
      // Errors interrupt; success/info wait their turn. A failure announced politely can be
      // dropped entirely if the user is mid-utterance, which is exactly when it matters most.
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(
        "rz-toast-in pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-soft",
        VARIANT_CLASS[item.variant]
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded opacity-70 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-1"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
