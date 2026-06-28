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

export function toast(message: string, variant: ToastVariant = "info") {
  const id = (counter += 1);
  items = [...items, { id, message, variant }];
  emit();
  setTimeout(() => dismiss(id), 4500);
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

  if (list.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[60] mx-auto flex max-w-sm flex-col gap-2 px-4"
      role="region"
      aria-label="Notifications"
    >
      {list.map((item) => {
        const Icon = VARIANT_ICON[item.variant];
        return (
          <div
            key={item.id}
            role="status"
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
              className="shrink-0 opacity-70 transition hover:opacity-100"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
