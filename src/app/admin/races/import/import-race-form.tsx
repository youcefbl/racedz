"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, Images, Plus, Sparkles, Trash2 } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { importRaceFromPostAction, type ImportRaceActionState } from "./actions";

const initialState: ImportRaceActionState = {};
const MAX_IMAGES = 6;
const MAX_CAPTION_LENGTH = 12_000;

export function ImportRaceForm() {
  const [state, formAction, pending] = useActionState(importRaceFromPostAction, initialState);
  const [imageRows, setImageRows] = useState(() => [{ id: crypto.randomUUID() }]);
  const [uploadingIds, setUploadingIds] = useState(() => new Set<string>());
  const [captionLength, setCaptionLength] = useState(0);

  function addImage() {
    setImageRows((rows) => (rows.length >= MAX_IMAGES ? rows : [...rows, { id: crypto.randomUUID() }]));
  }

  function removeImage(id: string) {
    setUploadingIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
    setImageRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== id)));
  }

  function setRowUploading(id: string, uploading: boolean) {
    setUploadingIds((ids) => {
      const next = new Set(ids);
      if (uploading) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const uploadsPending = uploadingIds.size > 0;

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div aria-live="polite" className="empty:hidden">
        {state.error ? (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            <p className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {state.error}
            </p>
            {state.existingRaceId ? (
              <Link href={`/admin/races/${state.existingRaceId}/edit`} className="mt-2 inline-block underline underline-offset-2">
                Open the existing draft
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <ol className="grid gap-2 text-sm sm:grid-cols-3" aria-label="Import workflow">
        {["Upload post", "AI extracts", "You verify"].map((label, index) => (
          <li key={label} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 font-semibold text-gray-700">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs text-white">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Images className="size-5 text-brand-orange" aria-hidden="true" />
          <h2 className="text-lg font-black text-gray-950">Post images</h2>
        </div>
        <p className="text-sm leading-6 text-gray-600">
          Upload the poster/screenshot(s) from the Instagram or Facebook post. Add each slide of a carousel
          (distances, prices, and payment details are often on separate images).
        </p>
        <div className="grid gap-3">
          {imageRows.map((row, index) => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
              <ImageUploadField
                label={`Image ${index + 1}`}
                name="imageUrls"
                scope="race"
                onUploadingChange={(uploading) => setRowUploading(row.id, uploading)}
              />
              {imageRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeImage(row.id)}
                  disabled={uploadingIds.has(row.id)}
                  className="inline-flex h-11 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {imageRows.length < MAX_IMAGES ? (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addImage}>
            <Plus className="size-4" aria-hidden="true" />
            Add another image
          </Button>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-gray-950">Caption &amp; source</h2>
        <label className="grid gap-2 text-sm font-semibold text-gray-800">
          Post caption
          <textarea
            name="caption"
            rows={7}
            maxLength={MAX_CAPTION_LENGTH}
            onChange={(event) => setCaptionLength(event.currentTarget.value.length)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950"
            placeholder="Paste the full post text here (French / Arabic / dialect all fine). The more text, the better the extraction."
          />
          <span className="text-end text-xs font-medium text-gray-500">
            {captionLength.toLocaleString()} / {MAX_CAPTION_LENGTH.toLocaleString()}
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Platform
            <select
              name="platform"
              defaultValue="INSTAGRAM"
              className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-950"
            >
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="MANUAL">Other</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-gray-800">
            Original post link <span className="font-normal text-gray-500">(optional)</span>
            <input
              name="sourceUrl"
              type="url"
              inputMode="url"
              className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-950"
              placeholder="https://www.instagram.com/p/..."
            />
            <span className="text-xs font-normal leading-5 text-gray-500">
              Kept for provenance and duplicate detection. ZidRun does not fetch the post from this link.
            </span>
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-2 border-t border-gray-200 pt-5">
        <Button type="submit" disabled={pending || uploadsPending} className="w-full sm:w-fit">
          <Sparkles className="size-4" aria-hidden="true" />
          {uploadsPending ? "Waiting for uploads…" : pending ? "Reading the post…" : "Extract & create draft"}
        </Button>
        <p className="text-xs font-medium text-gray-500">
          The AI reads the images and caption, then creates a <strong>draft</strong> race and opens it for you to
          review and publish. This can take up to a minute. AI can be wrong; imported drafts cannot be published until a human confirms the key details.
        </p>
      </div>
    </form>
  );
}
