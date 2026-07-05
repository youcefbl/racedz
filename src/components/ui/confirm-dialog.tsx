"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// Controlled confirmation dialog: the caller owns `open` and reacts to onConfirm/onCancel.
// Used for destructive actions (deleting a run, removing a photo) so nothing is lost by accident.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" aria-label={cancelLabel} className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-soft">
        <h2 className="text-base font-bold text-gray-950">{title}</h2>
        {description ? <p className="mt-1.5 text-sm leading-6 text-gray-600">{description}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
