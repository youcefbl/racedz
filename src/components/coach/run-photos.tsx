"use client";

import { ImagePlus, Loader2, Maximize2, X } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";
import type { CoachCopy } from "@/components/coach/copy";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { compressImage } from "@/lib/images/compress-image";
import { cn } from "@/lib/utils";

const MAX_CLIENT_BYTES = 5 * 1024 * 1024;

// Controlled run-photo gallery + uploader. Renders thumbnails (tap to view full, or remove),
// plus an "Add photo" button that uploads to /api/uploads under the `run` scope and hands the
// resulting URL back through onChange. Reused by the log-a-run form and each history row.
export function RunPhotoUploader({
  value,
  onChange,
  copy,
  max = 6,
  disabled = false,
  className
}: {
  value: string[];
  onChange: (next: string[]) => void | Promise<void>;
  copy: CoachCopy;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const atLimit = value.length >= max;

  async function addPhoto(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    setError(null);
    setUploading(true);

    try {
      // Shrink large phone photos so they fit the limit before we check/upload.
      const file = await compressImage(picked);
      if (file.size > MAX_CLIENT_BYTES) {
        setError(copy.photoUploadFailed);
        return;
      }

      const body = new FormData();
      body.set("scope", "run");
      body.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = (await response.json().catch(() => null)) as { data?: { url?: string }; error?: string } | null;
      if (!response.ok || !payload?.data?.url) {
        throw new Error(payload?.error || copy.photoUploadFailed);
      }
      await onChange([...value, payload.data.url]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.photoUploadFailed);
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(url: string) {
    setError(null);
    try {
      await onChange(value.filter((item) => item !== url));
    } catch {
      setError(copy.photoUploadFailed);
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="relative size-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
            <ImageLightbox src={url} alt={copy.viewPhoto} triggerClassName="absolute inset-0 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              <span className="absolute bottom-1 right-1 inline-flex size-6 items-center justify-center rounded bg-black/60 text-white">
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </span>
            </ImageLightbox>
            {!disabled ? (
              <button
                type="button"
                onClick={() => setPendingRemove(url)}
                aria-label={copy.removePhoto}
                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}

        {!disabled && !atLimit ? (
          <label
            htmlFor={inputId}
            className={cn(
              "flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 text-xs font-bold text-gray-500 transition hover:border-brand-teal hover:text-brand-teal",
              uploading && "pointer-events-none opacity-70"
            )}
          >
            {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
            <span>{uploading ? copy.photoUploading : copy.addPhoto}</span>
          </label>
        ) : null}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={addPhoto}
          disabled={disabled || uploading || atLimit}
        />
      </div>
      {error ? <p role="alert" className="text-xs font-bold text-red-700">{error}</p> : null}
      <ConfirmDialog
        open={pendingRemove !== null}
        title={copy.deletePhotoTitle}
        description={copy.deletePhotoText}
        confirmLabel={copy.confirmDelete}
        cancelLabel={copy.cancel}
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          const url = pendingRemove;
          setPendingRemove(null);
          if (url) void removePhoto(url);
        }}
      />
    </div>
  );
}
