"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ConfirmSubmitProps = {
  /** Trigger button content (icon + label). */
  children: ReactNode;
  /** Confirmation dialog copy. */
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Trigger styling — mirrors Button so it can drop in where a submit Button was. */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
};

/**
 * A submit button that asks for confirmation before submitting its parent <form>.
 * Drop it inside a `<form action={serverAction}>` in place of a submit Button — on
 * confirm it calls form.requestSubmit(), so the server action runs as usual.
 */
export function ConfirmSubmit({
  children,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  size = "sm",
  className,
  disabled
}: ConfirmSubmitProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        onClick={(event) => {
          formRef.current = event.currentTarget.closest("form");
          setOpen(true);
        }}
      >
        {children}
      </Button>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" aria-label={cancelLabel} className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-soft">
            <h2 className="text-base font-bold text-gray-950">{title}</h2>
            {description ? <p className="mt-1.5 text-sm text-gray-600">{description}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  formRef.current?.requestSubmit();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
