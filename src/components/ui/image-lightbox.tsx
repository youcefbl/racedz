"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  src: string;
  alt: string;
  children?: ReactNode;
  triggerClassName?: string;
};

export function ImageLightbox({ src, alt, children, triggerClassName }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "+" || event.key === "=") setZoom((value) => Math.min(3, value + 0.25));
      if (event.key === "-") setZoom((value) => Math.max(1, value - 0.25));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setZoom(1);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-inset",
          triggerClassName
        )}
        aria-label={`Open ${alt}`}
      >
        {children}
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div className="relative h-[calc(100dvh-6rem)] w-full max-w-6xl overflow-auto overscroll-contain rounded-lg bg-black sm:h-[calc(100dvh-8rem)]">
                <div className="relative h-full min-h-[60vh] w-full overflow-hidden">
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes="100vw"
                    priority
                    className="object-contain transition-transform duration-200"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
              </div>

              <div className="fixed inset-x-3 top-3 flex items-center justify-between gap-3 sm:inset-x-6 sm:top-6">
                <span className="truncate text-sm font-semibold text-white">{alt}</span>
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/20 bg-black/70 p-1 backdrop-blur">
                  <LightboxButton label="Zoom out" onClick={() => setZoom((value) => Math.max(1, value - 0.25))} disabled={zoom <= 1}>
                    <ZoomOut className="size-5" aria-hidden="true" />
                  </LightboxButton>
                  <span className="min-w-12 text-center text-xs font-bold text-white" aria-live="polite">
                    {Math.round(zoom * 100)}%
                  </span>
                  <LightboxButton label="Zoom in" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} disabled={zoom >= 3}>
                    <ZoomIn className="size-5" aria-hidden="true" />
                  </LightboxButton>
                  <LightboxButton label="Reset zoom" onClick={() => setZoom(1)} disabled={zoom === 1}>
                    <RotateCcw className="size-5" aria-hidden="true" />
                  </LightboxButton>
                  <LightboxButton label="Close image" onClick={close} autoFocus>
                    <X className="size-5" aria-hidden="true" />
                  </LightboxButton>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function LightboxButton({
  label,
  onClick,
  disabled = false,
  autoFocus = false,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-md text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35"
    >
      {children}
    </button>
  );
}
