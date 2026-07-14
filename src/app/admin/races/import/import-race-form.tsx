"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Images, Plus, Sparkles, Trash2 } from "lucide-react";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import { Button } from "@/components/ui/button";
import { importRaceFromPostAction, type ImportRaceActionState } from "./actions";

const initialState: ImportRaceActionState = {};
const MAX_IMAGES = 6;

export function ImportRaceForm() {
  const [state, formAction, pending] = useActionState(importRaceFromPostAction, initialState);
  const [imageRows, setImageRows] = useState(() => [{ id: crypto.randomUUID() }]);

  function addImage() {
    setImageRows((rows) => (rows.length >= MAX_IMAGES ? rows : [...rows, { id: crypto.randomUUID() }]));
  }

  function removeImage(id: string) {
    setImageRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== id)));
  }

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      ) : null}

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
              <ImageUploadField label={`Image ${index + 1}`} name="imageUrls" scope="race" />
              {imageRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeImage(row.id)}
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
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-950"
            placeholder="Paste the full post text here (French / Arabic / dialect all fine). The more text, the better the extraction."
          />
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
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-2 border-t border-gray-200 pt-5">
        <Button type="submit" disabled={pending} className="w-fit">
          <Sparkles className="size-4" aria-hidden="true" />
          {pending ? "Reading the post…" : "Extract & create draft"}
        </Button>
        <p className="text-xs font-medium text-gray-500">
          The AI reads the images and caption, then creates a <strong>draft</strong> race and opens it for you to
          review and publish. This can take 10–20 seconds. Nothing goes public until you publish it.
        </p>
      </div>
    </form>
  );
}
