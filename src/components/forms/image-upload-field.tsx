"use client";

import { useId, useState, type ChangeEvent } from "react";
import { ImageIcon, Loader2, Maximize2, Upload } from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { compressImage } from "@/lib/images/compress-image";
import { cn } from "@/lib/utils";
import type { UploadScope } from "@/lib/storage";

type ImageUploadFieldProps = {
  label: string;
  name: string;
  scope: UploadScope;
  defaultValue?: string | null;
  helpText?: string;
};

export function ImageUploadField({ label, name, scope, defaultValue, helpText }: ImageUploadFieldProps) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const [previewUrl, setPreviewUrl] = useState(defaultValue ?? "");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];

    if (!picked) {
      return;
    }

    setError("");
    setUploading(true);

    // Shrink large phone photos so they fit the limit before we check/upload.
    const file = await compressImage(picked);

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      event.target.value = "";
      setUploading(false);
      return;
    }

    const optimisticPreview = URL.createObjectURL(file);
    setPreviewUrl(optimisticPreview);

    try {
      const body = new FormData();
      body.set("scope", scope);
      body.set("file", file);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body
      });
      const payload = await readUploadResponse(response);

      if (!response.ok || !payload.data?.url) {
        throw new Error(payload.error || "Upload failed.");
      }

      setValue(payload.data.url);
      setPreviewUrl(payload.data.url);
    } catch (uploadError) {
      setValue(defaultValue ?? "");
      setPreviewUrl(defaultValue ?? "");
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(optimisticPreview);
      event.target.value = "";
    }
  }

  return (
    <div className="grid gap-2 text-sm font-semibold text-gray-800">
      <span>{label}</span>
      <input type="hidden" name={name} value={value} readOnly />
      <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[112px_1fr]">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
          {previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="size-full object-contain" />
              <ImageLightbox src={previewUrl} alt={`${label} preview`} triggerClassName="absolute inset-0">
                <span className="sr-only">View full image</span>
                <span className="absolute bottom-2 right-2 inline-flex size-8 items-center justify-center rounded-md bg-black/65 text-white">
                  <Maximize2 className="size-4" aria-hidden="true" />
                </span>
              </ImageLightbox>
            </>
          ) : (
            <ImageIcon className="size-8 text-gray-400" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col justify-center gap-2">
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-teal px-4 text-sm font-semibold text-white transition hover:bg-brand-tealDark",
              uploading ? "pointer-events-none opacity-70" : ""
            )}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
            {uploading ? "Uploading..." : value ? "Replace image" : "Upload image"}
          </label>
          <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={uploadImage} />
          <p className="text-xs font-medium leading-5 text-gray-500">{helpText ?? "JPG, PNG, WebP, or GIF. Max 5 MB."}</p>
          {value ? <p className="break-all text-xs font-medium text-gray-500">{value}</p> : null}
          {error ? <p className="text-xs font-bold text-red-700">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

async function readUploadResponse(response: Response): Promise<{ data?: { url?: string }; error?: string }> {
  const text = await response.text();

  if (!text) {
    return {
      error: response.ok ? "Upload response was empty." : `Upload failed with status ${response.status}.`
    };
  }

  try {
    return JSON.parse(text) as { data?: { url?: string }; error?: string };
  } catch {
    return {
      error: response.ok ? "Upload returned an invalid response." : `Upload failed with status ${response.status}.`
    };
  }
}
