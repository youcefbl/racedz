"use server";

import { readFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { revalidateRacesCache } from "@/lib/race-repository";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { extractRaceFromPost, ImportExtractionError, type ImportImage } from "@/lib/social-import/extract";
import { normalizeExtractedRace } from "@/lib/social-import/normalize";
import { createRaceDraftFromImport } from "@/lib/social-import/create";

export type ImportRaceActionState = {
  error?: string;
};

const IMPORT_SOURCES = new Set(["INSTAGRAM", "FACEBOOK", "MANUAL"]);
// Only local race-scope uploads (produced by /api/uploads) are accepted, and the shape is validated
// before it's turned into a filesystem path — this is the guard against path traversal.
const RACE_UPLOAD_URL = /^\/uploads\/race\/\d{4}-\d{2}\/[a-f0-9-]+\.(jpg|png|webp|gif)$/;
const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function importRaceFromPostAction(
  _previousState: ImportRaceActionState,
  formData: FormData
): Promise<ImportRaceActionState> {
  const session = await requireAdmin();

  if (session.user.role !== "SUPERADMIN") {
    return { error: "Only superadmins can import races." };
  }

  // AI vision calls cost money and take time — cap per admin.
  const limit = checkRateLimit(rateLimitKey("race-import", session.user.id), 20, 10 * 60_000);
  if (!limit.ok) {
    return { error: `Too many imports. Try again in ${limit.retryAfterSeconds}s.` };
  }

  const platform = String(formData.get("platform") ?? "MANUAL");
  const importSource = IMPORT_SOURCES.has(platform) ? platform : "MANUAL";
  const caption = String(formData.get("caption") ?? "").trim();
  const sourceUrlRaw = String(formData.get("sourceUrl") ?? "").trim();
  const sourceUrl = /^https?:\/\//i.test(sourceUrlRaw) ? sourceUrlRaw : undefined;

  const imageUrls = formData
    .getAll("imageUrls")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => RACE_UPLOAD_URL.test(value))
    .slice(0, 6);

  if (imageUrls.length === 0 && !caption) {
    return { error: "Upload at least one poster image or paste the post caption." };
  }

  let images: ImportImage[];
  try {
    images = await Promise.all(imageUrls.map(readUploadAsDataUrl));
  } catch {
    return { error: "Could not read one of the uploaded images. Re-upload and try again." };
  }

  let raceId: string;

  try {
    const extraction = await extractRaceFromPost({ images, caption });

    if (!extraction.race.isRace) {
      return { error: "This post doesn't look like a running-race announcement. Check the image/caption and try again." };
    }

    const draft = normalizeExtractedRace(extraction.race, caption);
    const race = await createRaceDraftFromImport(draft, {
      importSource,
      importSourceUrl: sourceUrl,
      importRawText: caption || undefined,
      importExtractionJson: {
        race: extraction.race,
        model: extraction.model,
        usage: extraction.usage,
        startDateWasMissing: draft.startDateWasMissing
      },
      mainImageUrl: imageUrls[0]
    });
    raceId = race.id;
  } catch (error) {
    if (error instanceof ImportExtractionError) {
      return { error: importErrorMessage(error) };
    }
    throw error;
  }

  revalidatePath("/admin/races");
  revalidateRacesCache();
  redirect(`/admin/races/${raceId}/edit?imported=1`);
}

async function readUploadAsDataUrl(url: string): Promise<ImportImage> {
  const ext = url.slice(url.lastIndexOf(".") + 1);
  const mime = MIME_BY_EXT[ext] ?? "image/jpeg";
  // url is validated against RACE_UPLOAD_URL, so joining under public/ is safe.
  const absolutePath = path.join(process.cwd(), "public", url);
  const bytes = await readFile(absolutePath);
  return { dataUrl: `data:${mime};base64,${bytes.toString("base64")}` };
}

function importErrorMessage(error: ImportExtractionError): string {
  if (error.code === "OPENAI_NOT_CONFIGURED") {
    return "AI import isn't configured yet. Set OPENAI_API_KEY (and optionally SOCIAL_IMPORT_MODEL).";
  }
  return "Couldn't read the post automatically. Try a clearer screenshot or paste the caption text.";
}
