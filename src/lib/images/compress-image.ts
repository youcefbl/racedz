// Client-only image downscaler. Phone-gallery photos are routinely 8–15 MB, which
// trips the 5 MB upload limit before the request even starts. This re-encodes a
// picked image to a smaller WebP (capping the longest edge) so it comfortably fits,
// saving upload bandwidth and disk on the server too.
//
// It fails SAFE: on anything it can't handle (GIFs, missing canvas/WebP support,
// decode errors, or when the result isn't actually smaller) it returns the original
// file untouched, so the existing size check still applies as a backstop.

const MAX_EDGE = 1920;
const QUALITY = 0.82;
// Below this, an image already uploads fine — don't re-encode it (avoids needlessly
// running lossy WebP over small logos/avatars/graphics). The "too big" errors come
// from multi-MB phone photos, which are well above this.
const SKIP_BELOW_BYTES = 1024 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return file;
  // Skip GIFs (canvas would flatten animation) and non-images.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;

  let bitmap: ImageBitmap | undefined;
  try {
    // "from-image" applies the photo's EXIF rotation. Without it, portrait phone
    // photos decode sideways and — since re-encoding to WebP drops the EXIF tag —
    // would upload permanently rotated.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
    // Bail if encoding failed, the browser ignored WebP (returned PNG/null), or it
    // didn't actually shrink the file.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
