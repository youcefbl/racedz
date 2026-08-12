import { apiError, apiOk, ApiError, withApi } from "@/lib/api/v1/http";
import { requireMobileUser } from "@/lib/api/v1/guard";
import { enforceRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { saveImageUpload, UploadError, type ImageUploadFile } from "@/lib/storage";
import { MAX_IMAGE_BYTES } from "@/lib/storage";
import { BodyTooLargeError, MULTIPART_OVERHEAD_BYTES, readBoundedFormData } from "@/lib/http/body";

export const dynamic = "force-dynamic";

/**
 * Image upload for bearer-authenticated clients — the mobile twin of /api/uploads.
 *
 * Deliberately narrower than the website's endpoint: there is no `scope` parameter, and everything
 * posted here lands in the `run` scope. The website's route accepts seven scopes and gates the
 * privileged ones on the caller's role; reproducing that here would mean re-implementing an
 * authorisation decision for a surface that only needs one answer. If the app later needs avatars,
 * that is a scope to add explicitly, not a parameter to open up.
 *
 * All the actual hardening — size ceiling, magic-byte sniffing, and re-encoding through sharp to
 * strip EXIF (including the GPS coordinates a run photo will certainly carry) — lives in
 * saveImageUpload and is shared with the website. This route must never grow its own copy.
 */
export const POST = withApi(async (request) => {
  const viewer = await requireMobileUser(request);

  // Matches the website's per-user upload budget: 30 images per 10 minutes. Enough for a run's
  // worth of photos several times over, tight enough that a single account cannot loop 5 MB
  // uploads to fill the disk.
  const limited = enforceRateLimit(rateLimitKey("v1-upload", viewer.id), 30, 10 * 60_000);
  if (limited) return apiError(request, new ApiError("RATE_LIMITED", "Too many uploads. Try again shortly."));

  const formData = await readBoundedFormData(request, MAX_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES).catch((error) => {
    if (error instanceof BodyTooLargeError) throw new ApiError("BAD_REQUEST", "Image must be 5 MB or smaller.");
    return null;
  });
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError("VALIDATION_FAILED", "Choose an image to upload.");
  }

  try {
    const upload = await saveImageUpload(file as ImageUploadFile, "run");
    return apiOk(request, upload);
  } catch (error) {
    // UploadError carries the runner-facing reason (too large, wrong format, not really an image).
    // Passing its message through is safe — it describes the file they chose, nothing about the
    // server — and it is the only way the app can say why the photo was refused.
    if (error instanceof UploadError) throw new ApiError("VALIDATION_FAILED", error.message);
    throw error;
  }
});
